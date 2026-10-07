-- Etap 1a, po kroku K6 (P7): zatwierdzenie ograniczenia origin dla calej tabeli.
-- Sprawdzone na bazie TESTOWEJ, NIE WYKONANE na produkcji.
-- VALIDATE CONSTRAINT czyta cala tabele pod blokada SHARE UPDATE EXCLUSIVE: odczyty i zwykle zapisy ida dalej,
-- czekaja tylko inne zmiany struktury. Idempotentne (ponowne wykonanie na zatwierdzonym ograniczeniu nic nie robi).

SET lock_timeout = '5s';
ALTER TABLE dam_assets VALIDATE CONSTRAINT dam_assets_origin_chk;
