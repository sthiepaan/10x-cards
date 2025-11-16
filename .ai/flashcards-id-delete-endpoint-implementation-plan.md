# API Endpoint Implementation Plan: DELETE /flashcards/{id}

## 1. Przegląd punktu końcowego

Endpoint DELETE `/flashcards/{id}` służy do usuwania fiszki należącej do autoryzowanego użytkownika. Endpoint jest kluczowy dla operacji zarządzania fiszkami, umożliwiając użytkownikom trwałe usunięcie niepotrzebnych fiszek z ich kolekcji. Endpoint zapewnia pełną walidację parametrów wejściowych, autoryzację oraz zwraca potwierdzenie usunięcia w formacie zgodnym z `DeleteFlashcardResponseDTO`. Operacja usuwania jest nieodwracalna i wymaga weryfikacji, że fiszka należy do użytkownika przed wykonaniem operacji.

## 2. Szczegóły żądania

- **Metoda HTTP**: DELETE
- **Struktura URL**: `/api/flashcards/{id}`
- **Parametry ścieżki**:
  - **Wymagane**:
    - `id` (number) – identyfikator fiszki do usunięcia (musi być dodatnią liczbą całkowitą)
- **Parametry query**: Brak
- **Request Body**: Brak (operacja DELETE nie wymaga ciała żądania)

## 3. Wykorzystywane typy

- **DeleteFlashcardResponseDTO** – odpowiedź zawierająca potwierdzenie usunięcia:
  - `success` (boolean) – zawsze `true` w przypadku sukcesu
  - `id` (number) – identyfikator usuniętej fiszki
- **FlashcardEntity** – typ encji z bazy danych używany wewnętrznie w serwisie do weryfikacji istnienia fiszki

## 4. Szczegóły odpowiedzi

- **Sukces (HTTP 200)**:
  ```json
  {
    "success": true,
    "id": 123
  }
  ```
- **Kody statusu**:
  - 200: Pomyślne usunięcie fiszki
  - 400: Nieprawidłowe dane wejściowe (np. nieprawidłowy format parametru `id`, `id` nie jest liczbą całkowitą, `id` jest ujemny lub równy zero)
  - 401: Brak autoryzacji (nieprawidłowy lub brakujący token)
  - 404: Fiszka nie została znaleziona (nie istnieje lub nie należy do użytkownika)
  - 500: Błąd serwera (np. problem z połączeniem z bazą danych, błąd podczas usuwania)

## 5. Przepływ danych

1. Klient wysyła żądanie DELETE z parametrem ścieżki `id` (np. `DELETE /api/flashcards/123`).
2. Warstwa API (`/src/pages/api/flashcards/[id].ts`) odbiera żądanie i weryfikuje dostępność połączenia z bazą danych.
3. Parametr `id` jest ekstrahowany z URL i walidowany przy użyciu biblioteki `zod`:
   - `id` musi być dodatnią liczbą całkowitą
   - `id` nie może być zerem
   - `id` nie może być ujemny
4. Wywoływany jest serwis (`FlashcardService`), który implementuje logikę biznesową:
   - Weryfikacja, czy fiszka istnieje i należy do użytkownika (użycie metody `getFlashcardById()` lub podobnej logiki weryfikacyjnej)
   - Jeśli fiszka nie istnieje lub nie należy do użytkownika, zwracany jest błąd 404
   - Usunięcie fiszki z bazy danych przy użyciu Supabase `.delete()` z filtrowaniem według `id` i `user_id`
   - Weryfikacja, że operacja usunięcia zakończyła się sukcesem
   - Zwrócenie potwierdzenia w formacie zgodnym z `DeleteFlashcardResponseDTO`
5. Wyniki są zwracane w formacie JSON z kodem statusu 200.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: Endpoint musi być dostępny tylko dla autoryzowanych użytkowników. Obecnie używany jest `DEFAULT_USER_ID`, ale w przyszłości należy zintegrować Supabase Auth do weryfikacji tokenu z nagłówka `Authorization`.
- **Autoryzacja**: Wszystkie zapytania do bazy danych muszą filtrować wyniki według `user_id`, aby upewnić się, że użytkownik może usuwać tylko swoje własne fiszki. Row-Level Security (RLS) w Supabase zapewnia dodatkową warstwę bezpieczeństwa na poziomie bazy danych.
- **Walidacja danych wejściowych**: Dokładna walidacja parametru `id` zapobiega atakom typu injection oraz zapewnia poprawność danych. Walidacja powinna sprawdzać:
  - Czy `id` jest dodatnią liczbą całkowitą
  - Czy `id` nie jest zerem
  - Czy `id` nie jest ujemny
- **Ochrona przed enumeracją**: Endpoint zwraca 404 zarówno gdy fiszka nie istnieje, jak i gdy nie należy do użytkownika, aby zapobiec enumeracji identyfikatorów fiszek innych użytkowników.
- **Ograniczenie ekspozycji błędów**: Szczegóły błędów bazy danych nie powinny być zwracane użytkownikowi. Błędy powinny być logowane wewnętrznie z odpowiednimi szczegółami.
- **Ochrona przed nieautoryzowanym usunięciem**: Endpoint musi weryfikować przynależność fiszki do użytkownika przed wykonaniem operacji usunięcia. Filtrowanie według `user_id` w zapytaniu DELETE zapewnia, że nie można usunąć fiszek innych użytkowników nawet w przypadku błędu w logice weryfikacji.
- **Idempotentność**: Operacja DELETE powinna być idempotentna – wielokrotne wywołanie z tym samym `id` powinno zwracać ten sam wynik (404 po pierwszym usunięciu, jeśli fiszka już nie istnieje).

## 7. Obsługa błędów

- **400 – Invalid Input**:
  - Zwracane, gdy:
    - Parametr `id` nie spełnia wymagań walidacyjnych (nie jest liczbą całkowitą, jest ujemny lub równy zero)
    - Parametr `id` jest pusty lub nie został podany
- **401 – Unauthorized**:
  - Zwracane, gdy użytkownik nie jest zalogowany lub token autoryzacyjny jest nieprawidłowy (do zaimplementowania w przyszłości z Supabase Auth).
- **404 – Not Found**:
  - Zwracane, gdy:
    - Fiszka o podanym `id` nie istnieje w bazie danych
    - Fiszka istnieje, ale nie należy do autoryzowanego użytkownika (dla bezpieczeństwa zwracany jest ten sam kod 404)
- **500 – Internal Server Error**:
  - Zwracane w przypadku błędów serwera lub problemów z bazą danych (np. utrata połączenia, błędy zapytań SQL, błędy podczas usuwania).

## 8. Rozważania dotyczące wydajności

- **Indeksy bazy danych**: Upewnij się, że w tabeli `flashcards` istnieją odpowiednie indeksy:
  - `id` (PRIMARY KEY) – automatycznie indeksowane
  - `user_id` – wymagane dla wszystkich zapytań filtrowanych według użytkownika
  - Złożony indeks `(id, user_id)` może poprawić wydajność zapytań, które filtrują jednocześnie według obu pól
- **Optymalizacja zapytania**: Zapytanie usuwające powinno używać filtrowania według `id` i `user_id` w jednym zapytaniu, aby uniknąć dodatkowego zapytania SELECT przed DELETE. Jednak weryfikacja istnienia fiszki przed usunięciem może być korzystna dla lepszych komunikatów błędów.
- **Walidacja przed zapytaniem**: Wszystkie walidacje powinny być wykonane przed wykonaniem zapytania do bazy danych, aby uniknąć niepotrzebnych operacji.
- **Pojedyncze zapytanie**: W idealnym przypadku usunięcie powinno być wykonane w jednym zapytaniu DELETE z filtrowaniem według `id` i `user_id`. Weryfikacja liczby usuniętych wierszy pozwala na określenie, czy fiszka została znaleziona i usunięta.
- **Cascade delete**: Należy sprawdzić, czy w bazie danych istnieją zależności (np. w innych tabelach), które mogą wymagać obsługi cascade delete. W przypadku tabeli `flashcards`, kolumna `generation_id` ma `ON DELETE SET NULL`, więc usunięcie fiszki nie wpłynie na rekordy w tabeli `generations`.

## 9. Etapy wdrożenia

1. **Rozszerzenie serwisu FlashcardService** (`/src/lib/flashcard.service.ts`):
   - Dodanie metody `deleteFlashcardById()` przyjmującej parametry:
     - `flashcardId` (number) – ID fiszki do usunięcia
     - `userId` (string) – ID użytkownika dla autoryzacji
   - Implementacja logiki:
     - Weryfikacja, czy fiszka istnieje i należy do użytkownika (użycie istniejącej metody `getFlashcardById()` lub podobnej logiki weryfikacyjnej)
     - Rzucenie odpowiedniego błędu, jeśli fiszka nie została znaleziona
     - Wykonanie zapytania DELETE w Supabase z filtrowaniem według `id` i `user_id`
     - Weryfikacja, że operacja usunięcia zakończyła się sukcesem (sprawdzenie liczby usuniętych wierszy)
     - Zwrócenie danych w formacie `DeleteFlashcardResponseDTO` z `success: true` i `id` usuniętej fiszki
     - Obsługa błędów bazy danych z odpowiednimi komunikatami
   - Dodanie komentarzy JSDoc do metody opisujących parametry, zwracaną wartość oraz możliwe błędy

2. **Utworzenie endpointu DELETE** w pliku `/src/pages/api/flashcards/[id].ts`:
   - Dodanie eksportu `DELETE: APIRoute` do istniejącego pliku
   - Sprawdzenie dostępności połączenia z bazą danych (`locals.supabase`)
   - Ekstrakcja parametru `id` z `params.id`
   - Walidacja parametru `id` przy użyciu `zod`:
     - Schema dla `id` jako dodatniej liczby całkowitej
     - Transformacja z stringa na liczbę
     - Walidacja, że `id` jest większe od zera
   - Wywołanie metody `deleteFlashcardById()` z serwisu
   - Zwrócenie odpowiedzi w formacie JSON z kodem statusu 200 i danymi zgodnymi z `DeleteFlashcardResponseDTO`
   - Dodanie komentarzy JSDoc do endpointu opisujących parametry, odpowiedź oraz możliwe błędy

3. **Obsługa błędów**:
   - Obsługa błędów walidacji z odpowiednim kodem statusu 400
   - Obsługa błędów "not found" z odpowiednim kodem statusu 404
   - Obsługa błędów bazy danych z odpowiednim kodem statusu 500
   - Logowanie błędów do konsoli (w przyszłości rozważyć bardziej zaawansowane logowanie)
   - Upewnienie się, że błędy autoryzacji (fiszka nie należy do użytkownika) zwracają 404, a nie 403, aby zapobiec enumeracji
   - Obsługa przypadku, gdy parametr `id` jest pusty lub nie został podany (kod statusu 400)

4. **Dokumentacja**:
   - Dodanie komentarzy JSDoc do metody serwisu `deleteFlashcardById()`
   - Dodanie komentarzy JSDoc do endpointu API
   - Opcjonalnie: aktualizacja dokumentacji API (jeśli istnieje)
