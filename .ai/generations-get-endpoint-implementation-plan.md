# API Endpoint Implementation Plan: GET /generations

## 1. Przegląd punktu końcowego

Endpoint GET `/generations` służy do pobierania paginowanej, sortowanej listy żądań generacji dla zalogowanego użytkownika. Endpoint umożliwia przeglądanie historii generacji fiszek z możliwością sortowania według różnych pól oraz paginacji wyników. Każdy rekord generacji zawiera metadane dotyczące procesu generacji, takie jak model AI, liczba wygenerowanych fiszek, czas trwania generacji oraz statystyki akceptacji.

## 2. Szczegóły żądania

- **Metoda HTTP**: GET
- **Struktura URL**: `/api/generations`
- **Parametry query**:
  - **Wymagane**: Brak
  - **Opcjonalne**:
    - `page` (number, domyślnie: 1) – numer strony wyników
    - `limit` (number, domyślnie: 10) – liczba wyników na stronę (maksimum: 100)
    - `sort` (string, domyślnie: `created_at`) – pole do sortowania (np. `created_at`, `updated_at`, `id`, `generation_duration`, `generated_count`)
    - `order` (string, domyślnie: `desc`) – kierunek sortowania (`asc` lub `desc`)
- **Request Body**: Brak

## 3. Wykorzystywane typy

- **GetGenerationsResponseDTO** – struktura odpowiedzi zawierająca:
  - `data` (GenerationDTO[]) – tablica rekordów generacji
  - `pagination` (PaginationDTO) – informacje o paginacji
- **GenerationDTO** – pojedynczy rekord generacji w liście, zawierający:
  - `id` (number)
  - `model` (string)
  - `generated_count` (number)
  - `accepted_unedited_count` (number | null)
  - `accepted_edited_count` (number | null)
  - `source_text_hash` (string)
  - `source_text_length` (number)
  - `generation_duration` (number)
  - `created_at` (string)
  - `updated_at` (string)
- **PaginationDTO** – informacje o paginacji:
  - `page` (number)
  - `limit` (number)
  - `total` (number) – całkowita liczba dostępnych rekordów

**Uwaga**: Obecna definicja `GetGenerationsResponseDTO` w `types.ts` nie zawiera pola `pagination`. Należy ją zaktualizować, aby dodać paginację zgodnie ze specyfikacją API.

## 4. Szczegóły odpowiedzi

- **Sukces (HTTP 200)**:
  ```json
  {
    "data": [
      {
        "id": 1,
        "model": "gpt-4o-mini",
        "generated_count": 5,
        "accepted_unedited_count": 3,
        "accepted_edited_count": 1,
        "source_text_hash": "abc123def456",
        "source_text_length": 5000,
        "generation_duration": 45000,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25
    }
  }
  ```
- **Kody statusu**:
  - 200: Pomyślne pobranie listy generacji
  - 400: Nieprawidłowe parametry query (np. nieprawidłowa wartość `order`, nieprawidłowy typ `page`, `limit`, lub nieprawidłowe pole `sort`)
  - 401: Brak autoryzacji (nieprawidłowy lub brakujący token)
  - 500: Błąd serwera (np. problem z połączeniem z bazą danych)

## 5. Przepływ danych

1. Klient wysyła żądanie GET z opcjonalnymi parametrami query (`page`, `limit`, `sort`, `order`).
2. Warstwa API (`/src/pages/api/generations.ts`) odbiera żądanie i weryfikuje dostępność połączenia z bazą danych.
3. Parametry query są walidowane przy użyciu biblioteki `zod`:
   - `page` i `limit` muszą być dodatnimi liczbami całkowitymi
   - `limit` nie może przekraczać rozsądnego maksimum (np. 100)
   - `sort` musi być jednym z dozwolonych pól (np. `created_at`, `updated_at`, `id`, `generation_duration`, `generated_count`)
   - `order` musi być `asc` lub `desc`
4. Wywoływany jest serwis (`GenerationService`), który implementuje logikę biznesową:
   - Pobieranie rekordów generacji z bazy danych z filtrowaniem według `user_id` (autoryzowany użytkownik)
   - Zastosowanie sortowania według parametrów `sort` i `order`
   - Obliczenie całkowitej liczby rekordów (przed paginacją) dla informacji o paginacji
   - Zastosowanie paginacji (`page`, `limit`)
   - Zwrócenie tylko pól zgodnych z `GenerationDTO` (pominięcie `user_id` w odpowiedzi)
5. Wyniki są zwracane w formacie zgodnym z `GetGenerationsResponseDTO`.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: Endpoint musi być dostępny tylko dla autoryzowanych użytkowników. Obecnie używany jest `DEFAULT_USER_ID`, ale w przyszłości należy zintegrować Supabase Auth do weryfikacji tokenu z nagłówka `Authorization`.
- **Autoryzacja**: Wszystkie zapytania do bazy danych muszą filtrować wyniki według `user_id`, aby upewnić się, że użytkownik może zobaczyć tylko swoje własne rekordy generacji. Row-Level Security (RLS) w Supabase zapewnia dodatkową warstwę bezpieczeństwa na poziomie bazy danych.
- **Walidacja danych wejściowych**: Dokładna walidacja parametrów query zapobiega atakom typu injection oraz zapewnia poprawność danych. Ograniczenie maksymalnej wartości `limit` zapobiega przeciążeniu serwera.
- **Ograniczenie ekspozycji błędów**: Szczegóły błędów bazy danych nie powinny być zwracane użytkownikowi. Błędy powinny być logowane wewnętrznie z odpowiednimi szczegółami.
- **Ochrona danych wrażliwych**: Endpoint zwraca `source_text_hash` zamiast pełnego tekstu źródłowego, co zapewnia prywatność danych użytkownika.

## 7. Obsługa błędów

- **400 – Invalid Input**:
  - Zwracane, gdy parametry query nie spełniają wymagań walidacyjnych, np.:
    - `page` lub `limit` nie są dodatnimi liczbami całkowitymi
    - `limit` przekracza maksymalną dozwoloną wartość (100)
    - `sort` nie jest jednym z dozwolonych pól
    - `order` nie jest `asc` lub `desc`
- **401 – Unauthorized**:
  - Zwracane, gdy użytkownik nie jest zalogowany lub token autoryzacyjny jest nieprawidłowy (do zaimplementowania w przyszłości z Supabase Auth).
- **500 – Internal Server Error**:
  - Zwracane w przypadku błędów serwera lub problemów z bazą danych (np. utrata połączenia, błędy zapytań SQL).
  - Szczegóły błędów są logowane do konsoli, ale nie są zwracane w odpowiedzi użytkownikowi.

## 8. Rozważania dotyczące wydajności

- **Paginacja**: Wymagana paginacja zapobiega pobieraniu zbyt dużej liczby rekordów jednocześnie, co poprawia wydajność i zmniejsza obciążenie bazy danych.
- **Indeksy bazy danych**: Upewnij się, że w tabeli `generations` istnieją odpowiednie indeksy na kolumnach używanych do filtrowania i sortowania:
  - `user_id` (wymagane dla wszystkich zapytań) – powinien być indeksowany jako klucz obcy
  - `created_at`, `updated_at` (dla sortowania) – rozważ dodanie indeksów dla często używanych pól sortowania
  - `generation_duration`, `generated_count` (dla sortowania) – opcjonalne indeksy, jeśli sortowanie według tych pól będzie często używane
- **Limit maksymalny**: Ustawienie maksymalnego limitu dla parametru `limit` (100) zapobiega przeciążeniu serwera przez zbyt duże zapytania.
- **Zliczanie całkowitej liczby rekordów**: Operacja `COUNT(*)` może być kosztowna dla dużych tabel. Rozważ użycie przybliżonych metod zliczania lub cache'owania dla bardzo dużych zbiorów danych, jeśli liczba rekordów generacji będzie bardzo duża.
- **Selekcja pól**: Zapytanie powinno wybierać tylko niezbędne pola, pomijając `user_id` w odpowiedzi, co zmniejsza ilość przesyłanych danych.

## 9. Etapy wdrożenia

1. **Aktualizacja typów DTO** (`/src/types.ts`):
   - Zaktualizować `GetGenerationsResponseDTO`, aby zawierał pole `pagination: PaginationDTO`:
     ```typescript
     export interface GetGenerationsResponseDTO {
       data: GenerationDTO[];
       pagination: PaginationDTO;
     }
     ```

2. **Rozszerzenie serwisu GenerationService** (`/src/lib/generation.service.ts`):
   - Dodanie metody `getGenerations()` przyjmującej parametry:
     - `userId` (string) – ID użytkownika
     - `page` (number, domyślnie: 1)
     - `limit` (number, domyślnie: 10)
     - `sort` (string, domyślnie: `created_at`)
     - `order` (`asc` | `desc`, domyślnie: `desc`)
   - Implementacja logiki:
     - Budowanie zapytania Supabase z filtrowaniem według `user_id`
     - Zastosowanie sortowania według parametrów `sort` i `order`
     - Obliczenie całkowitej liczby rekordów (przed paginacją) przy użyciu `count: "exact"` w Supabase
     - Zastosowanie paginacji (`from` i `limit`)
     - Zwrócenie danych w formacie `GetGenerationsResponseDTO` z pominięciem `user_id` w odpowiedzi
     - Obsługa błędów z odpowiednimi komunikatami

3. **Utworzenie endpointu GET** w pliku `/src/pages/api/generations.ts`:
   - Dodanie eksportu `GET: APIRoute` (obecnie plik zawiera tylko `POST`)
   - Sprawdzenie dostępności połączenia z bazą danych (`locals.supabase`)
   - Parsowanie i walidacja parametrów query przy użyciu `zod`:
     - Schema dla parametrów query z odpowiednimi typami i wartościami domyślnymi
     - Walidacja wartości `sort` (dozwolone pola: `created_at`, `updated_at`, `id`, `generation_duration`, `generated_count`)
     - Walidacja wartości `order` (`asc` lub `desc`)
     - Walidacja `page` i `limit` jako dodatnich liczb całkowitych
     - Ograniczenie maksymalnej wartości `limit` do 100
   - Wywołanie metody `getGenerations()` z serwisu
   - Zwrócenie odpowiedzi w formacie JSON z kodem statusu 200

4. **Obsługa błędów**:
   - Obsługa błędów walidacji z odpowiednim kodem statusu 400 i czytelnymi komunikatami
   - Obsługa błędów bazy danych z odpowiednim kodem statusu 500
   - Logowanie błędów do konsoli (w przyszłości rozważyć bardziej zaawansowane logowanie)
   - Zwracanie ogólnych komunikatów błędów użytkownikowi bez ujawniania szczegółów technicznych

5. **Dokumentacja**:
   - Dodanie komentarzy JSDoc do metody `getGenerations()` w serwisie
   - Dodanie komentarzy JSDoc do endpointu GET API
   - Opcjonalnie: aktualizacja dokumentacji API (jeśli istnieje)
