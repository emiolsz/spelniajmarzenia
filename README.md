# Stowarzyszenie Marzenia — wersja testowa na Vercel

1. Rozpakuj ZIP. Wgraj zawartość jego głównego folderu do osobnego, najlepiej prywatnego repozytorium GitHub, wraz z plikami zaczynającymi się od kropki. Nie wgrywaj pliku .env z sekretami.
2. W Supabase uruchom zawartość `supabase/setup.sql` w SQL Editorze. Możesz użyć projektu Pracowni Estery. Skrypt tworzy osobną tabelę i osobny zasobnik zdjęć Marzeń. Zdjęcia artykułów w tym zasobniku są publiczne.
3. W Vercel zaimportuj repo jako nowy projekt. W ustawieniach projektu dodaj zmienne z `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` to serwerowy klucz service_role (legacy JWT). `MARZENIA_ADMIN_EMAIL` ustaw na testowy adres administratora z Pracowni. Konto musi już istnieć w wybranym Supabase i mieć potwierdzony e-mail. W szablonie logowania Supabase potrzebny jest kod `{{ .Token }}`. Użyj działającej konfiguracji poczty.
4. Wdróż i otwórz stronę. Przetestuj odczyt bez logowania, wejście przez „Admin”, odbiór kodu, publikację wpisu ze zdjęciami i wylogowanie. Sprawdź też, czy inny adres nie może publikować.
5. Po testach ustaw docelowy adres w `MARZENIA_ADMIN_EMAIL` w projekcie Marzeń i zrób ponowne wdrożenie. Docelowe konto musi już istnieć w Supabase. Konfiguracja Pracowni Estery jest niezależna.

W paczce są wpisy zapisane w kodzie strony, w tym nagroda z 24 sierpnia 2026 r. Wpisy dodane przez panel do magazynu prywatnego demo Sites wymagają oddzielnej migracji. Darowizny nadal są demonstracyjne. Formularz kontaktowy wymaga konfiguracji SMTP opisanej poniżej. Wersja Vercel używa osobnego logowania e-mail; po wygaśnięciu sesji zaloguj się ponownie.

## Kontakt i Facebook

Kontakt korzysta z serwerowego SMTP Brevo. W Vercel dodaj sekret `BREVO_SMTP_KEY` dla Production, a następnie wdróż ponownie. To klucz SMTP Brevo, nie klucz API ani hasło do poczty. Bez niego formularz wyświetla informację o niedostępności i zachowuje bezpośredni adres stowarzyszenia. Nigdy nie potwierdza wysyłki bez akceptacji wiadomości przez SMTP. Nadawca to zweryfikowany w Brevo `emikon888@gmail.com`, odbiorca `stowarzyszeniemarzenia@gmail.com`; adres odwiedzającego trafia do Reply-To.

Adres strony Facebook można zmienić po zalogowaniu w panelu. Dotyczy odnośników, nie automatycznego publikowania. Ustawienia są zapisywane w zarezerwowanym rekordzie `00000000-0000-4000-8000-000000000099`, wyłączonym z list artykułów i ich edycji/usuwania.
