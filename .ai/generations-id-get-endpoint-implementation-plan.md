# API Endpoint Implementation Plan: GET /generations/{id}

## 1. Przegląd punktu końcowego

Endpoint GET `/generations/{id}` służy do pobierania szczegółowych informacji o pojedynczej generacji wraz z powiązanymi fiszkami. Endpoint zwraca pełne metadane generacji (z wyjątkiem `user_id` ze względów bezpieczeństwa) oraz listę wszystkich fiszek powiązanych z tą generacją poprzez `generation_id`. Endpoint jest kluczowy dla operacji wyświetlania szczegółów generacji, analizy wyników generacji oraz przeglądania fiszek utworzonych w ramach konkretnej generacji.

## 2. Szczegóły żądania

- **Metoda HTTP**: GET
- **Struktura URL**: `/api/generations/{id}`
- **Parametry ścieżki**:
  - **Wymagane**:
    - `id` (number) – identyfikator generacji do pobrania (musi być dodatnią liczbą całkowitą)
- **Parametry query**: Brak
- **Request Body**: Brak

## 3. Wykorzystywane typy

- **GetGenerationDetailResponseDTO** – struktura odpowiedzi zawierająca:
  - `generation` (GenerationDTO) – szczegółowe metadane generacji
  - `flashcards` (FlashcardDetailDTO[]) – tablica fiszek powiązanych z generacją
- **GenerationDTO** – szczegółowa struktura generacji (Omit<GenerationEntity, "user_id">), zawierająca:
  - `id` (number) – identyfikator generacji
  - `model` (string) – model AI użyty do generacji
  - `generated_count` (number) – liczba wygenerowanych fiszek
  - `accepted_unedited_count` (number | null) – liczba zaakceptowanych fiszek bez edycji
  - `accepted_edited_count` (number | null) – liczba zaakceptowanych fiszek po edycji
  - `source_text_hash` (string) – hash tekstu źródłowego
  - `source_text_length` (number) – długość tekstu źródłowego (1000-10000 znaków)
  - `generation_duration` (number) – czas trwania generacji w milisekundach
  - `created_at` (string) – data utworzenia
  - `updated_at` (string) – data ostatniej aktualizacji
- **FlashcardDetailDTO** – szczegółowa struktura fiszki (Omit<FlashcardEntity, "user_id">), zawierająca:
  - `id` (number) – identyfikator fiszki
  - `front` (string) – tekst przedniej strony fiszki (max 200 znaków)
  - `back` (string) – tekst tylnej strony fiszki (max 500 znaków)
  - `source` (string) – źródło fiszki (`ai-full`, `ai-edited`, `manual`)
  - `created_at` (string) – data utworzenia
  - `updated_at` (string) – data ostatniej aktualizacji
  - `generation_id` (number | null) – identyfikator generacji (null dla fiszek manualnych)
- **GenerationEntity** – pełna encja z bazy danych (używana wewnętrznie w serwisie)

## 4. Szczegóły odpowiedzi

- **Sukces (HTTP 200)**:
  ```json
  {
    "generation": {
      "id": 1,
      "model": "gpt-4o-mini",
      "generated_count": 5,
      "accepted_unedited_count": 3,
      "accepted_edited_count": 1,
      "source_text_hash": "abc123def456",
      "source_text_length": 5000,
      "generation_duration": 2500,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    },
    "flashcards": [
      {
        "id": 1,
        "front": "Question 1",
        "back": "Answer 1",
        "source": "ai-full",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "generation_id": 1
      },
      {
        "id": 2,
        "front": "Question 2",
        "back": "Answer 2",
        "source": "ai-edited",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "generation_id": 1
      }
    ]
  }
  ```
- **Kody statusu**:
  - 200: Pomyślne pobranie generacji i powiązanych fiszek
  - 400: Nieprawidłowy parametr `id` (np. nie jest liczbą całkowitą, jest ujemny lub zero)
  - 401: Brak autoryzacji (nieprawidłowy lub brakujący token)
  - 404: Generacja nie została znaleziona (nie istnieje lub nie należy do użytkownika)
  - 500: Błąd serwera (np. problem z połączeniem z bazą danych)

## 5. Przepływ danych

1. Klient wysyła żądanie GET z parametrem ścieżki `id` (np. `/api/generations/123`).
2. Warstwa API (`/src/pages/api/generations/[id].ts`) odbiera żądanie i weryfikuje dostępność połączenia z bazą danych (`locals.supabase`).
3. Parametr `id` jest ekstrahowany z URL i walidowany przy użyciu biblioteki `zod`:
   - `id` musi być dodatnią liczbą całkowitą
   - `id` nie może być zerem
   - Transformacja z stringa na liczbę
4. Wywoływany jest serwis (`GenerationService`), który implementuje logikę biznesową:
   - Pobieranie generacji z bazy danych z filtrowaniem według `id` i `user_id` (autoryzowany użytkownik)
   - Weryfikacja, czy generacja istnieje i należy do użytkownika
   - Jeśli generacja nie istnieje lub nie należy do użytkownika, zwracany jest błąd 404
   - Pobieranie wszystkich fiszek powiązanych z generacją poprzez `generation_id` z filtrowaniem według `user_id`
   - Zwrócenie danych w formacie zgodnym z `GetGenerationDetailResponseDTO`:
     - `generation` w formacie `GenerationDTO` (pominięcie `user_id`)
     - `flashcards` jako tablica `FlashcardDetailDTO[]` (pominięcie `user_id` w każdej fiszce)
5. Wyniki są zwracane w formacie JSON z kodem statusu 200.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: Endpoint musi być dostępny tylko dla autoryzowanych użytkowników. Obecnie używany jest `DEFAULT_USER_ID`, ale w przyszłości należy zintegrować Supabase Auth do weryfikacji tokenu z nagłówka `Authorization`.
- **Autoryzacja**: Wszystkie zapytania do bazy danych muszą filtrować wyniki według `user_id`, aby upewnić się, że użytkownik może zobaczyć tylko swoje własne generacje i fiszki. Row-Level Security (RLS) w Supabase zapewnia dodatkową warstwę bezpieczeństwa na poziomie bazy danych.
- **Walidacja danych wejściowych**: Dokładna walidacja parametru `id` zapobiega atakom typu injection oraz zapewnia poprawność danych. Walidacja powinna sprawdzać, czy `id` jest dodatnią liczbą całkowitą.
- **Ochrona przed enumeracją**: Endpoint zwraca 404 zarówno gdy generacja nie istnieje, jak i gdy nie należy do użytkownika, aby zapobiec enumeracji identyfikatorów generacji innych użytkowników.
- **Ograniczenie ekspozycji błędów**: Szczegóły błędów bazy danych nie powinny być zwracane użytkownikowi. Błędy powinny być logowane wewnętrznie z odpowiednimi szczegółami.
- **Spójność danych**: Endpoint zwraca tylko fiszki, które rzeczywiście należą do użytkownika, nawet jeśli `generation_id` wskazuje na generację użytkownika. Zapewnia to spójność danych i bezpieczeństwo.

## 7. Obsługa błędów

- **400 – Invalid Input**:
  - Zwracane, gdy parametr `id` nie spełnia wymagań walidacyjnych, np.:
    - `id` nie jest liczbą całkowitą
    - `id` jest ujemne lub równe zero
    - `id` nie może być sparsowane z URL
  - Format odpowiedzi:
    ```json
    {
      "error": "Validation failed",
      "details": "ID must be a positive integer"
    }
    ```
- **401 – Unauthorized**:
  - Zwracane, gdy użytkownik nie jest zalogowany lub token autoryzacyjny jest nieprawidłowy (do zaimplementowania w przyszłości z Supabase Auth).
- **404 – Not Found**:
  - Zwracane, gdy:
    - Generacja o podanym `id` nie istnieje w bazie danych
    - Generacja istnieje, ale nie należy do autoryzowanego użytkownika (dla bezpieczeństwa zwracany jest ten sam kod 404)
  - Format odpowiedzi:
    ```json
    {
      "error": "Not found",
      "message": "Generation with ID {id} not found"
    }
    ```
- **500 – Internal Server Error**:
  - Zwracane w przypadku błędów serwera lub problemów z bazą danych (np. utrata połączenia, błędy zapytań SQL).
  - Format odpowiedzi:
    ```json
    {
      "error": "Internal server error",
      "message": "An unexpected error occurred while processing your request"
    }
    ```

## 8. Rozważania dotyczące wydajności

- **Indeksy bazy danych**: Upewnij się, że w tabelach istnieją odpowiednie indeksy:
  - `generations.id` (PRIMARY KEY) – automatycznie indeksowane
  - `generations.user_id` – wymagane dla wszystkich zapytań filtrowanych według użytkownika
  - `flashcards.generation_id` – wymagane dla zapytań pobierających fiszki powiązane z generacją
  - `flashcards.user_id` – wymagane dla wszystkich zapytań filtrowanych według użytkownika
  - Złożony indeks `(generation_id, user_id)` na tabeli `flashcards` może poprawić wydajność zapytań, które filtrują jednocześnie według obu pól
- **Optymalizacja zapytania**:
  - Zapytanie dla generacji powinno używać `.single()` w Supabase, aby zwrócić tylko jeden rekord
  - Zapytanie dla fiszek powinno używać `.eq()` dla `generation_id` i `user_id` z odpowiednimi indeksami
  - Rozważ użycie jednego zapytania z JOIN, jeśli Supabase to obsługuje, aby zmniejszyć liczbę round-tripów do bazy danych
- **Lazy loading fiszek**: Jeśli liczba fiszek w generacji może być bardzo duża, rozważ paginację lub lazy loading fiszek (opcjonalne, do rozważenia w przyszłości).
- **Cache'owanie**: Rozważ cache'owanie często używanych generacji, jeśli aplikacja ma wysokie obciążenie (opcjonalne, do rozważenia w przyszłości).

## 9. Etapy wdrożenia

1. **Rozszerzenie serwisu GenerationService** (`/src/lib/generation.service.ts`):
   - Dodanie metody `getGenerationById()` przyjmującej parametry:
     - `generationId` (number) – ID generacji do pobrania
     - `userId` (string) – ID użytkownika dla autoryzacji
   - Implementacja logiki:
     - Budowanie zapytania Supabase dla generacji z filtrowaniem według `id` i `user_id`
     - Użycie `.single()` do zwrócenia pojedynczego rekordu
     - Obsługa przypadku, gdy generacja nie istnieje lub nie należy do użytkownika
     - Pobieranie wszystkich fiszek powiązanych z generacją poprzez `generation_id` z filtrowaniem według `user_id`
     - Zwrócenie danych w formacie `GetGenerationDetailResponseDTO`:
       - `generation` w formacie `GenerationDTO` (pominięcie `user_id` w select)
       - `flashcards` jako tablica `FlashcardDetailDTO[]` (pominięcie `user_id` w select)
     - Rzucenie odpowiedniego błędu, jeśli generacja nie została znaleziona
     - Obsługa błędów bazy danych z odpowiednimi komunikatami

2. **Utworzenie endpointu GET** w pliku `/src/pages/api/generations/[id].ts`:
   - Utworzenie nowego pliku dla dynamicznego routingu Astro
   - Dodanie eksportu `GET: APIRoute`
   - Sprawdzenie dostępności połączenia z bazą danych (`locals.supabase`)
   - Ekstrakcja parametru `id` z `params.id`
   - Walidacja parametru `id` przy użyciu `zod`:
     - Schema dla `id` jako dodatniej liczby całkowitej
     - Transformacja z stringa na liczbę
     - Walidacja, że `id` jest większe od zera
   - Wywołanie metody `getGenerationById()` z serwisu
   - Zwrócenie odpowiedzi w formacie JSON z kodem statusu 200

3. **Obsługa błędów**:
   - Obsługa błędów walidacji z odpowiednim kodem statusu 400
   - Obsługa błędów "not found" z odpowiednim kodem statusu 404
   - Obsługa błędów bazy danych z odpowiednim kodem statusu 500
   - Logowanie błędów do konsoli (w przyszłości rozważyć bardziej zaawansowane logowanie)
   - Upewnienie się, że błędy autoryzacji (generacja nie należy do użytkownika) zwracają 404, a nie 403, aby zapobiec enumeracji
   - Spójne formatowanie komunikatów błędów zgodnie z istniejącymi wzorcami w projekcie

4. **Dokumentacja**:
   - Dodanie komentarzy JSDoc do metody serwisu `getGenerationById()`
   - Dodanie komentarzy JSDoc do endpointu API
   - Opcjonalnie: aktualizacja dokumentacji API (jeśli istnieje)
