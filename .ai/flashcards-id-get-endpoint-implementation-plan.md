# API Endpoint Implementation Plan: GET /flashcards/{id}

## 1. Przegląd punktu końcowego

Endpoint GET `/flashcards/{id}` służy do pobierania szczegółowych informacji o pojedynczej fiszce na podstawie jej identyfikatora. Endpoint zapewnia pełny widok fiszki, włączając wszystkie pola z wyjątkiem `user_id` (które jest pomijane ze względów bezpieczeństwa). Endpoint jest kluczowy dla operacji wyświetlania szczegółów fiszki, edycji oraz innych operacji wymagających dostępu do pełnych danych pojedynczej fiszki.

## 2. Szczegóły żądania

- **Metoda HTTP**: GET
- **Struktura URL**: `/api/flashcards/{id}`
- **Parametry ścieżki**:
  - **Wymagane**:
    - `id` (number) – identyfikator fiszki do pobrania
- **Parametry query**: Brak
- **Request Body**: Brak

## 3. Wykorzystywane typy

- **FlashcardDetailDTO** – szczegółowa struktura fiszki, zawierająca:
  - `id` (number) – identyfikator fiszki
  - `front` (string) – tekst przedniej strony fiszki (max 200 znaków)
  - `back` (string) – tekst tylnej strony fiszki (max 500 znaków)
  - `source` (string) – źródło fiszki (`ai-full`, `ai-edited`, `manual`)
  - `created_at` (string) – data utworzenia
  - `updated_at` (string) – data ostatniej aktualizacji
  - `generation_id` (number | null) – opcjonalny identyfikator generacji (null dla fiszek manualnych)
- **FlashcardEntity** – pełna encja z bazy danych (używana wewnętrznie w serwisie)

## 4. Szczegóły odpowiedzi

- **Sukces (HTTP 200)**:
  ```json
  {
    "id": 1,
    "front": "Question",
    "back": "Answer",
    "source": "manual",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "generation_id": null
  }
  ```
- **Kody statusu**:
  - 200: Pomyślne pobranie fiszki
  - 400: Nieprawidłowy parametr `id` (np. nie jest liczbą całkowitą, jest ujemny lub zero)
  - 401: Brak autoryzacji (nieprawidłowy lub brakujący token)
  - 404: Fiszka nie została znaleziona (nie istnieje lub nie należy do użytkownika)
  - 500: Błąd serwera (np. problem z połączeniem z bazą danych)

## 5. Przepływ danych

1. Klient wysyła żądanie GET z parametrem ścieżki `id` (np. `/api/flashcards/123`).
2. Warstwa API (`/src/pages/api/flashcards/[id].ts`) odbiera żądanie i weryfikuje dostępność połączenia z bazą danych.
3. Parametr `id` jest ekstrahowany z URL i walidowany przy użyciu biblioteki `zod`:
   - `id` musi być dodatnią liczbą całkowitą
   - `id` nie może być zerem
4. Wywoływany jest serwis (`FlashcardService`), który implementuje logikę biznesową:
   - Pobieranie fiszki z bazy danych z filtrowaniem według `id` i `user_id` (autoryzowany użytkownik)
   - Weryfikacja, czy fiszka istnieje i należy do użytkownika
   - Jeśli fiszka nie istnieje lub nie należy do użytkownika, zwracany jest błąd 404
   - Zwrócenie danych w formacie zgodnym z `FlashcardDetailDTO` (pominięcie `user_id` w odpowiedzi)
5. Wyniki są zwracane w formacie JSON z kodem statusu 200.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: Endpoint musi być dostępny tylko dla autoryzowanych użytkowników. Obecnie używany jest `DEFAULT_USER_ID`, ale w przyszłości należy zintegrować Supabase Auth do weryfikacji tokenu z nagłówka `Authorization`.
- **Autoryzacja**: Wszystkie zapytania do bazy danych muszą filtrować wyniki według `user_id`, aby upewnić się, że użytkownik może zobaczyć tylko swoje własne fiszki. Row-Level Security (RLS) w Supabase zapewnia dodatkową warstwę bezpieczeństwa na poziomie bazy danych.
- **Walidacja danych wejściowych**: Dokładna walidacja parametru `id` zapobiega atakom typu injection oraz zapewnia poprawność danych. Walidacja powinna sprawdzać, czy `id` jest dodatnią liczbą całkowitą.
- **Ochrona przed enumeracją**: Endpoint zwraca 404 zarówno gdy fiszka nie istnieje, jak i gdy nie należy do użytkownika, aby zapobiec enumeracji identyfikatorów fiszek innych użytkowników.
- **Ograniczenie ekspozycji błędów**: Szczegóły błędów bazy danych nie powinny być zwracane użytkownikowi. Błędy powinny być logowane wewnętrznie z odpowiednimi szczegółami.

## 7. Obsługa błędów

- **400 – Invalid Input**:
  - Zwracane, gdy parametr `id` nie spełnia wymagań walidacyjnych, np.:
    - `id` nie jest liczbą całkowitą
    - `id` jest ujemne lub równe zero
    - `id` nie może być sparsowane z URL
- **401 – Unauthorized**:
  - Zwracane, gdy użytkownik nie jest zalogowany lub token autoryzacyjny jest nieprawidłowy (do zaimplementowania w przyszłości z Supabase Auth).
- **404 – Not Found**:
  - Zwracane, gdy:
    - Fiszka o podanym `id` nie istnieje w bazie danych
    - Fiszka istnieje, ale nie należy do autoryzowanego użytkownika (dla bezpieczeństwa zwracany jest ten sam kod 404)
- **500 – Internal Server Error**:
  - Zwracane w przypadku błędów serwera lub problemów z bazą danych (np. utrata połączenia, błędy zapytań SQL).

## 8. Rozważania dotyczące wydajności

- **Indeksy bazy danych**: Upewnij się, że w tabeli `flashcards` istnieją odpowiednie indeksy:
  - `id` (PRIMARY KEY) – automatycznie indeksowane
  - `user_id` – wymagane dla wszystkich zapytań filtrowanych według użytkownika
  - Złożony indeks `(id, user_id)` może poprawić wydajność zapytań, które filtrują jednocześnie według obu pól
- **Optymalizacja zapytania**: Zapytanie powinno używać `.single()` w Supabase, aby zwrócić tylko jeden rekord i zakończyć wykonanie po znalezieniu pierwszego dopasowania.
- **Cache'owanie**: Rozważ cache'owanie często używanych fiszek, jeśli aplikacja ma wysokie obciążenie (opcjonalne, do rozważenia w przyszłości).

## 9. Etapy wdrożenia

1. **Rozszerzenie serwisu FlashcardService** (`/src/lib/flashcard.service.ts`):
   - Dodanie metody `getFlashcardById()` przyjmującej parametry:
     - `flashcardId` (number) – ID fiszki do pobrania
     - `userId` (string) – ID użytkownika dla autoryzacji
   - Implementacja logiki:
     - Budowanie zapytania Supabase z filtrowaniem według `id` i `user_id`
     - Użycie `.single()` do zwrócenia pojedynczego rekordu
     - Obsługa przypadku, gdy fiszka nie istnieje lub nie należy do użytkownika
     - Zwrócenie danych w formacie `FlashcardDetailDTO` (pominięcie `user_id`)
     - Rzucenie odpowiedniego błędu, jeśli fiszka nie została znaleziona

2. **Utworzenie endpointu GET** w pliku `/src/pages/api/flashcards/[id].ts`:
   - Utworzenie nowego pliku dla dynamicznego routingu Astro
   - Dodanie eksportu `GET: APIRoute`
   - Sprawdzenie dostępności połączenia z bazą danych (`locals.supabase`)
   - Ekstrakcja parametru `id` z `params.id`
   - Walidacja parametru `id` przy użyciu `zod`:
     - Schema dla `id` jako dodatniej liczby całkowitej
     - Transformacja z stringa na liczbę
     - Walidacja, że `id` jest większe od zera
   - Wywołanie metody `getFlashcardById()` z serwisu
   - Zwrócenie odpowiedzi w formacie JSON z kodem statusu 200

3. **Obsługa błędów**:
   - Obsługa błędów walidacji z odpowiednim kodem statusu 400
   - Obsługa błędów "not found" z odpowiednim kodem statusu 404
   - Obsługa błędów bazy danych z odpowiednim kodem statusu 500
   - Logowanie błędów do konsoli (w przyszłości rozważyć bardziej zaawansowane logowanie)
   - Upewnienie się, że błędy autoryzacji (fiszka nie należy do użytkownika) zwracają 404, a nie 403, aby zapobiec enumeracji

4. **Dokumentacja**:
   - Dodanie komentarzy JSDoc do metody serwisu `getFlashcardById()`
   - Dodanie komentarzy JSDoc do endpointu API
   - Opcjonalnie: aktualizacja dokumentacji API (jeśli istnieje)
