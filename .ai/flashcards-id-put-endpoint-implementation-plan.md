# API Endpoint Implementation Plan: PUT /flashcards/{id}

## 1. Przegląd punktu końcowego

Endpoint PUT `/flashcards/{id}` służy do aktualizacji istniejącej fiszki. Endpoint umożliwia modyfikację pól `front`, `back` oraz `source` fiszki należącej do autoryzowanego użytkownika. Endpoint jest kluczowy dla operacji edycji fiszek, umożliwiając użytkownikom aktualizację treści oraz zmianę źródła fiszki (np. z `ai-full` na `ai-edited` po ręcznej edycji). Endpoint zapewnia pełną walidację danych wejściowych, autoryzację oraz zwraca zaktualizowaną fiszkę w formacie zgodnym z `FlashcardDetailDTO`.

## 2. Szczegóły żądania

- **Metoda HTTP**: PUT
- **Struktura URL**: `/api/flashcards/{id}`
- **Parametry ścieżki**:
  - **Wymagane**:
    - `id` (number) – identyfikator fiszki do aktualizacji
- **Parametry query**: Brak
- **Request Body**: JSON z polami do aktualizacji (wszystkie pola opcjonalne, ale przynajmniej jedno musi być podane):
  ```json
  {
    "front": "Updated question text",
    "back": "Updated answer text",
    "source": "ai-edited"
  }
  ```

  - `front` (string, opcjonalne) – tekst przedniej strony fiszki (max 200 znaków)
  - `back` (string, opcjonalne) – tekst tylnej strony fiszki (max 500 znaków)
  - `source` (string, opcjonalne) – źródło fiszki (`ai-edited` lub `manual`)

## 3. Wykorzystywane typy

- **UpdateFlashcardCommand** – komenda aktualizacji fiszki, zawierająca:
  - `front` (string, opcjonalne) – tekst przedniej strony fiszki (max 200 znaków)
  - `back` (string, opcjonalne) – tekst tylnej strony fiszki (max 500 znaków)
  - `source` (string, opcjonalne) – źródło fiszki (`ai-edited` lub `manual`)
- **UpdateFlashcardResponseDTO** – odpowiedź zawierająca zaktualizowaną fiszkę w formacie `FlashcardDetailDTO`:
  - `id` (number) – identyfikator fiszki
  - `front` (string) – tekst przedniej strony fiszki
  - `back` (string) – tekst tylnej strony fiszki
  - `source` (string) – źródło fiszki
  - `created_at` (string) – data utworzenia
  - `updated_at` (string) – data ostatniej aktualizacji (automatycznie aktualizowana przez trigger bazy danych)
  - `generation_id` (number | null) – opcjonalny identyfikator generacji (nie jest modyfikowalny przez endpoint)
- **FlashcardUpdateEntity** – typ encji z bazy danych używany wewnętrznie w serwisie

## 4. Szczegóły odpowiedzi

- **Sukces (HTTP 200)**:
  ```json
  {
    "id": 1,
    "front": "Updated question",
    "back": "Updated answer",
    "source": "ai-edited",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T12:30:00Z",
    "generation_id": 123
  }
  ```
- **Kody statusu**:
  - 200: Pomyślna aktualizacja fiszki
  - 400: Nieprawidłowe dane wejściowe (np. przekroczona długość pola, nieprawidłowa wartość `source`, brak pól do aktualizacji, nieprawidłowy format JSON)
  - 401: Brak autoryzacji (nieprawidłowy lub brakujący token)
  - 404: Fiszka nie została znaleziona (nie istnieje lub nie należy do użytkownika)
  - 500: Błąd serwera (np. problem z połączeniem z bazą danych, błąd podczas aktualizacji)

## 5. Przepływ danych

1. Klient wysyła żądanie PUT z parametrem ścieżki `id` oraz ciałem JSON zawierającym pola do aktualizacji (np. `PUT /api/flashcards/123` z ciałem `{"front": "New question"}`).
2. Warstwa API (`/src/pages/api/flashcards/[id].ts`) odbiera żądanie i weryfikuje dostępność połączenia z bazą danych.
3. Parametr `id` jest ekstrahowany z URL i walidowany przy użyciu biblioteki `zod`:
   - `id` musi być dodatnią liczbą całkowitą
   - `id` nie może być zerem
4. Ciało żądania jest parsowane i walidowane przy użyciu `zod`:
   - Sprawdzenie, czy przynajmniej jedno pole (`front`, `back`, `source`) jest podane
   - Walidacja długości `front` (max 200 znaków) i `back` (max 500 znaków)
   - Walidacja wartości `source` (tylko `ai-edited` lub `manual`)
   - Wszystkie pola są opcjonalne, ale przynajmniej jedno musi być podane
5. Wywoływany jest serwis (`FlashcardService`), który implementuje logikę biznesową:
   - Weryfikacja, czy fiszka istnieje i należy do użytkownika (użycie metody `getFlashcardById()` lub podobnej)
   - Jeśli fiszka nie istnieje lub nie należy do użytkownika, zwracany jest błąd 404
   - Aktualizacja fiszki w bazie danych przy użyciu Supabase `.update()` z filtrowaniem według `id` i `user_id`
   - Pobranie zaktualizowanej fiszki z bazy danych
   - Zwrócenie danych w formacie zgodnym z `FlashcardDetailDTO` (pominięcie `user_id` w odpowiedzi)
6. Wyniki są zwracane w formacie JSON z kodem statusu 200.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: Endpoint musi być dostępny tylko dla autoryzowanych użytkowników. Obecnie używany jest `DEFAULT_USER_ID`, ale w przyszłości należy zintegrować Supabase Auth do weryfikacji tokenu z nagłówka `Authorization`.
- **Autoryzacja**: Wszystkie zapytania do bazy danych muszą filtrować wyniki według `user_id`, aby upewnić się, że użytkownik może edytować tylko swoje własne fiszki. Row-Level Security (RLS) w Supabase zapewnia dodatkową warstwę bezpieczeństwa na poziomie bazy danych.
- **Walidacja danych wejściowych**: Dokładna walidacja parametru `id` oraz pól w ciele żądania zapobiega atakom typu injection oraz zapewnia poprawność danych. Walidacja powinna sprawdzać:
  - Czy `id` jest dodatnią liczbą całkowitą
  - Czy przynajmniej jedno pole jest podane do aktualizacji
  - Czy długości pól nie przekraczają limitów
  - Czy wartość `source` jest dozwolona (tylko `ai-edited` lub `manual`, nie `ai-full`)
- **Ochrona przed enumeracją**: Endpoint zwraca 404 zarówno gdy fiszka nie istnieje, jak i gdy nie należy do użytkownika, aby zapobiec enumeracji identyfikatorów fiszek innych użytkowników.
- **Ograniczenie ekspozycji błędów**: Szczegóły błędów bazy danych nie powinny być zwracane użytkownikowi. Błędy powinny być logowane wewnętrznie z odpowiednimi szczegółami.
- **Ochrona przed nieautoryzowaną modyfikacją**: Endpoint nie pozwala na modyfikację `generation_id`, `user_id`, `created_at` ani `id` – te pola są chronione i nie mogą być zmienione przez użytkownika.
- **Walidacja źródła**: Endpoint nie pozwala na zmianę `source` na `ai-full`, ponieważ fiszki z tym źródłem powinny być tworzone tylko przez proces generacji AI, a nie przez ręczną edycję.

## 7. Obsługa błędów

- **400 – Invalid Input**:
  - Zwracane, gdy:
    - Parametr `id` nie spełnia wymagań walidacyjnych (nie jest liczbą całkowitą, jest ujemny lub równy zero)
    - Ciało żądania nie zawiera przynajmniej jednego pola do aktualizacji (`front`, `back`, `source`)
    - Pole `front` przekracza 200 znaków
    - Pole `back` przekracza 500 znaków
    - Wartość `source` nie jest jedną z dozwolonych wartości (`ai-edited` lub `manual`)
    - Ciało żądania nie jest prawidłowym JSON
    - Ciało żądania zawiera nieprawidłowe pola (np. próba modyfikacji `id`, `user_id`, `generation_id`, `created_at`)
- **401 – Unauthorized**:
  - Zwracane, gdy użytkownik nie jest zalogowany lub token autoryzacyjny jest nieprawidłowy (do zaimplementowania w przyszłości z Supabase Auth).
- **404 – Not Found**:
  - Zwracane, gdy:
    - Fiszka o podanym `id` nie istnieje w bazie danych
    - Fiszka istnieje, ale nie należy do autoryzowanego użytkownika (dla bezpieczeństwa zwracany jest ten sam kod 404)
- **500 – Internal Server Error**:
  - Zwracane w przypadku błędów serwera lub problemów z bazą danych (np. utrata połączenia, błędy zapytań SQL, błędy podczas aktualizacji).

## 8. Rozważania dotyczące wydajności

- **Indeksy bazy danych**: Upewnij się, że w tabeli `flashcards` istnieją odpowiednie indeksy:
  - `id` (PRIMARY KEY) – automatycznie indeksowane
  - `user_id` – wymagane dla wszystkich zapytań filtrowanych według użytkownika
  - Złożony indeks `(id, user_id)` może poprawić wydajność zapytań, które filtrują jednocześnie według obu pól
- **Optymalizacja zapytania**: Zapytanie aktualizujące powinno używać filtrowania według `id` i `user_id` w jednym zapytaniu, aby uniknąć dodatkowego zapytania SELECT przed UPDATE. Supabase automatycznie aktualizuje `updated_at` przez trigger bazy danych.
- **Walidacja przed zapytaniem**: Wszystkie walidacje powinny być wykonane przed wykonaniem zapytania do bazy danych, aby uniknąć niepotrzebnych operacji.
- **Pojedyncze zapytanie**: Aktualizacja i pobranie zaktualizowanej fiszki powinny być wykonane w sposób efektywny, najlepiej w jednym zapytaniu z użyciem `.select()` po `.update()` w Supabase.

## 9. Etapy wdrożenia

1. **Rozszerzenie serwisu FlashcardService** (`/src/lib/flashcard.service.ts`):
   - Dodanie metody `updateFlashcardById()` przyjmującej parametry:
     - `flashcardId` (number) – ID fiszki do aktualizacji
     - `userId` (string) – ID użytkownika dla autoryzacji
     - `updateData` (UpdateFlashcardCommand) – dane do aktualizacji
   - Implementacja logiki:
     - Weryfikacja, czy fiszka istnieje i należy do użytkownika (użycie istniejącej metody `getFlashcardById()` lub podobnej logiki)
     - Rzucenie odpowiedniego błędu, jeśli fiszka nie została znaleziona
     - Walidacja danych aktualizacji (długości pól, wartości `source`)
     - Wykonanie zapytania UPDATE w Supabase z filtrowaniem według `id` i `user_id`
     - Pobranie zaktualizowanej fiszki z bazy danych przy użyciu `.select()` po `.update()`
     - Zwrócenie danych w formacie `FlashcardDetailDTO` (pominięcie `user_id`)
     - Obsługa błędów bazy danych z odpowiednimi komunikatami

2. **Utworzenie endpointu PUT** w pliku `/src/pages/api/flashcards/[id].ts`:
   - Dodanie eksportu `PUT: APIRoute` do istniejącego pliku (lub utworzenie nowego, jeśli nie istnieje)
   - Sprawdzenie dostępności połączenia z bazą danych (`locals.supabase`)
   - Ekstrakcja parametru `id` z `params.id`
   - Walidacja parametru `id` przy użyciu `zod`:
     - Schema dla `id` jako dodatniej liczby całkowitej
     - Transformacja z stringa na liczbę
     - Walidacja, że `id` jest większe od zera
   - Parsowanie i walidacja ciała żądania przy użyciu `zod`:
     - Schema dla `UpdateFlashcardCommand` z opcjonalnymi polami `front`, `back`, `source`
     - Walidacja, że przynajmniej jedno pole jest podane
     - Walidacja długości `front` (max 200 znaków) i `back` (max 500 znaków)
     - Walidacja wartości `source` (tylko `ai-edited` lub `manual`)
     - Odrzucenie nieprawidłowych pól (np. `id`, `user_id`, `generation_id`, `created_at`)
   - Wywołanie metody `updateFlashcardById()` z serwisu
   - Zwrócenie odpowiedzi w formacie JSON z kodem statusu 200

3. **Obsługa błędów**:
   - Obsługa błędów walidacji z odpowiednim kodem statusu 400
   - Obsługa błędów "not found" z odpowiednim kodem statusu 404
   - Obsługa błędów bazy danych z odpowiednim kodem statusu 500
   - Logowanie błędów do konsoli (w przyszłości rozważyć bardziej zaawansowane logowanie)
   - Upewnienie się, że błędy autoryzacji (fiszka nie należy do użytkownika) zwracają 404, a nie 403, aby zapobiec enumeracji
   - Obsługa błędów parsowania JSON z odpowiednim kodem statusu 400

4. **Dokumentacja**:
   - Dodanie komentarzy JSDoc do metody serwisu `updateFlashcardById()`
   - Dodanie komentarzy JSDoc do endpointu API
   - Opcjonalnie: aktualizacja dokumentacji API (jeśli istnieje)
