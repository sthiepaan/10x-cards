# API Endpoint Implementation Plan: GET /flashcards

## 1. Przegląd punktu końcowego

Endpoint GET `/flashcards` służy do pobierania paginowanej, filtrowanej i sortowanej listy fiszek dla zalogowanego użytkownika. Endpoint zapewnia elastyczne opcje wyszukiwania i prezentacji danych, umożliwiając klientom efektywne przeglądanie swoich fiszek z możliwością filtrowania według źródła (`source`) lub generacji (`generation_id`), sortowania według różnych pól oraz paginacji wyników.

## 2. Szczegóły żądania

- **Metoda HTTP**: GET
- **Struktura URL**: `/api/flashcards`
- **Parametry query**:
  - **Wymagane**: Brak
  - **Opcjonalne**:
    - `page` (number, domyślnie: 1) – numer strony wyników
    - `limit` (number, domyślnie: 10) – liczba wyników na stronę
    - `sort` (string, domyślnie: `created_at`) – pole do sortowania (np. `created_at`, `updated_at`, `id`)
    - `order` (string, domyślnie: `desc`) – kierunek sortowania (`asc` lub `desc`)
    - `source` (string, opcjonalnie) – filtr według źródła (`ai-full`, `ai-edited`, `manual`)
    - `generation_id` (number, opcjonalnie) – filtr według ID generacji
- **Request Body**: Brak

## 3. Wykorzystywane typy

- **GetFlashcardsResponseDTO** – struktura odpowiedzi zawierająca:
  - `data` (FlashcardSummaryDTO[]) – tablica fiszek
  - `pagination` (PaginationDTO) – informacje o paginacji
- **FlashcardSummaryDTO** – pojedyncza fiszka w liście, zawierająca:
  - `id` (number)
  - `front` (string)
  - `back` (string)
  - `source` (string)
  - `created_at` (string)
  - `updated_at` (string)
- **PaginationDTO** – informacje o paginacji:
  - `page` (number)
  - `limit` (number)
  - `total` (number) – całkowita liczba dostępnych rekordów

## 4. Szczegóły odpowiedzi

- **Sukces (HTTP 200)**:
  ```json
  {
    "data": [
      {
        "id": 1,
        "front": "Question",
        "back": "Answer",
        "source": "manual",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100
    }
  }
  ```
- **Kody statusu**:
  - 200: Pomyślne pobranie listy fiszek
  - 400: Nieprawidłowe parametry query (np. nieprawidłowa wartość `order`, `source`, lub nieprawidłowy typ `page`, `limit`, `generation_id`)
  - 401: Brak autoryzacji (nieprawidłowy lub brakujący token)
  - 500: Błąd serwera (np. problem z połączeniem z bazą danych)

## 5. Przepływ danych

1. Klient wysyła żądanie GET z opcjonalnymi parametrami query (`page`, `limit`, `sort`, `order`, `source`, `generation_id`).
2. Warstwa API (`/src/pages/api/flashcards.ts`) odbiera żądanie i weryfikuje dostępność połączenia z bazą danych.
3. Parametry query są walidowane przy użyciu biblioteki `zod`:
   - `page` i `limit` muszą być dodatnimi liczbami całkowitymi
   - `limit` nie może przekraczać rozsądnego maksimum (np. 100)
   - `sort` musi być jednym z dozwolonych pól (np. `created_at`, `updated_at`, `id`)
   - `order` musi być `asc` lub `desc`
   - `source` (jeśli podane) musi być jedną z wartości: `ai-full`, `ai-edited`, `manual`
   - `generation_id` (jeśli podane) musi być dodatnią liczbą całkowitą
4. Wywoływany jest serwis (`FlashcardService`), który implementuje logikę biznesową:
   - Pobieranie fiszek z bazy danych z filtrowaniem według `user_id` (autoryzowany użytkownik)
   - Zastosowanie opcjonalnych filtrów (`source`, `generation_id`)
   - Zastosowanie sortowania według parametrów `sort` i `order`
   - Obliczenie całkowitej liczby rekordów (przed paginacją) dla informacji o paginacji
   - Zastosowanie paginacji (`page`, `limit`)
   - Zwrócenie tylko pól zgodnych z `FlashcardSummaryDTO` (pominięcie `user_id` i `generation_id` w odpowiedzi)
5. Wyniki są zwracane w formacie zgodnym z `GetFlashcardsResponseDTO`.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: Endpoint musi być dostępny tylko dla autoryzowanych użytkowników. Obecnie używany jest `DEFAULT_USER_ID`, ale w przyszłości należy zintegrować Supabase Auth do weryfikacji tokenu z nagłówka `Authorization`.
- **Autoryzacja**: Wszystkie zapytania do bazy danych muszą filtrować wyniki według `user_id`, aby upewnić się, że użytkownik może zobaczyć tylko swoje własne fiszki. Row-Level Security (RLS) w Supabase zapewnia dodatkową warstwę bezpieczeństwa na poziomie bazy danych.
- **Walidacja danych wejściowych**: Dokładna walidacja parametrów query zapobiega atakom typu injection oraz zapewnia poprawność danych. Ograniczenie maksymalnej wartości `limit` zapobiega przeciążeniu serwera.
- **Ograniczenie ekspozycji błędów**: Szczegóły błędów bazy danych nie powinny być zwracane użytkownikowi. Błędy powinny być logowane wewnętrznie z odpowiednimi szczegółami.

## 7. Obsługa błędów

- **400 – Invalid Input**:
  - Zwracane, gdy parametry query nie spełniają wymagań walidacyjnych, np.:
    - `page` lub `limit` nie są dodatnimi liczbami całkowitymi
    - `limit` przekracza maksymalną dozwoloną wartość
    - `sort` nie jest jednym z dozwolonych pól
    - `order` nie jest `asc` lub `desc`
    - `source` nie jest jedną z dozwolonych wartości
    - `generation_id` nie jest dodatnią liczbą całkowitą
- **401 – Unauthorized**:
  - Zwracane, gdy użytkownik nie jest zalogowany lub token autoryzacyjny jest nieprawidłowy (do zaimplementowania w przyszłości z Supabase Auth).
- **500 – Internal Server Error**:
  - Zwracane w przypadku błędów serwera lub problemów z bazą danych (np. utrata połączenia, błędy zapytań SQL).

## 8. Rozważania dotyczące wydajności

- **Paginacja**: Wymagana paginacja zapobiega pobieraniu zbyt dużej liczby rekordów jednocześnie, co poprawia wydajność i zmniejsza obciążenie bazy danych.
- **Indeksy bazy danych**: Upewnij się, że w tabeli `flashcards` istnieją odpowiednie indeksy na kolumnach używanych do filtrowania i sortowania:
  - `user_id` (wymagane dla wszystkich zapytań)
  - `source` (jeśli filtrowanie według źródła jest często używane)
  - `generation_id` (jeśli filtrowanie według generacji jest często używane)
  - `created_at`, `updated_at` (dla sortowania)
- **Limit maksymalny**: Ustawienie maksymalnego limitu dla parametru `limit` (np. 100) zapobiega przeciążeniu serwera przez zbyt duże zapytania.
- **Zliczanie całkowitej liczby rekordów**: Operacja `COUNT(*)` może być kosztowna dla dużych tabel. Rozważ użycie przybliżonych metod zliczania lub cache'owania dla bardzo dużych zbiorów danych.

## 9. Etapy wdrożenia

1. **Rozszerzenie serwisu FlashcardService** (`/src/lib/flashcard.service.ts`):
   - Dodanie metody `getFlashcards()` przyjmującej parametry:
     - `userId` (string) – ID użytkownika
     - `page` (number, domyślnie: 1)
     - `limit` (number, domyślnie: 10)
     - `sort` (string, domyślnie: `created_at`)
     - `order` (`asc` | `desc`, domyślnie: `desc`)
     - `source` (string | undefined) – opcjonalny filtr
     - `generationId` (number | undefined) – opcjonalny filtr
   - Implementacja logiki:
     - Budowanie zapytania Supabase z filtrowaniem według `user_id`
     - Zastosowanie opcjonalnych filtrów (`source`, `generation_id`)
     - Zastosowanie sortowania
     - Obliczenie całkowitej liczby rekordów (przed paginacją)
     - Zastosowanie paginacji (`from` i `limit`)
     - Zwrócenie danych w formacie `GetFlashcardsResponseDTO`

2. **Utworzenie endpointu GET** w pliku `/src/pages/api/flashcards.ts`:
   - Dodanie eksportu `GET: APIRoute`
   - Sprawdzenie dostępności połączenia z bazą danych (`locals.supabase`)
   - Parsowanie i walidacja parametrów query przy użyciu `zod`:
     - Schema dla parametrów query z odpowiednimi typami i wartościami domyślnymi
     - Walidacja wartości `sort` (dozwolone pola)
     - Walidacja wartości `order` (`asc` lub `desc`)
     - Walidacja wartości `source` (jeśli podane)
     - Walidacja `page`, `limit`, `generation_id` jako dodatnich liczb całkowitych
     - Ograniczenie maksymalnej wartości `limit`
   - Wywołanie metody `getFlashcards()` z serwisu
   - Zwrócenie odpowiedzi w formacie JSON z kodem statusu 200

3. **Obsługa błędów**:
   - Obsługa błędów walidacji z odpowiednim kodem statusu 400
   - Obsługa błędów bazy danych z odpowiednim kodem statusu 500
   - Logowanie błędów do konsoli (w przyszłości rozważyć bardziej zaawansowane logowanie)

4. **Dokumentacja**:
   - Dodanie komentarzy JSDoc do metody serwisu
   - Dodanie komentarzy JSDoc do endpointu API
   - Opcjonalnie: aktualizacja dokumentacji API (jeśli istnieje)
