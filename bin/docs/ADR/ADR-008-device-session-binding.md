# ADR-008 - Wiazanie sesji z ID maszyny

Status: Accepted  
Date: 2026-07-18

## Context

DAM ETA ma docelowo stac na udziale sieciowym / serwerze plikow: uzytkownik uruchamia skrot i dziala bez instalacji Dockera. Wspolna baza kont (SQLite) nie moze powodowac, ze osoba B na PC B jest automatycznie zalogowana jako osoba A (token skopiowany z localStorage / bound-session / WebView cache).

## Decision

Przy **kazdym** starcie `launch.py`:

1. Oblicz `machine_id` = SHA256(MachineGuid + hostname + USERDOMAIN + Windows user + volume serial).
2. `device_id` = deterministyczny z `machine_id` (`dam-dev-…`).
3. Porownaj z `apps/desktop/data/bound-session.json`. Przy mismatch: usun binding, ostrzez, wymus login.
4. Login zapisuje w SQLite: `machine_id`, `device_id`, `session_id` (losowy), `windows_user`, `hostname`, hash tokenu.
5. `GET /auth/me` wymaga zgodnosci `machine_id` / `device_id` z biezaca maszyna.

UI bierze tozsamosc z `GET /auth/identity` (most) lub `data/dam-identity.json` (zapis przy starcie) - nie z losowego UUID przegladarki.

## Consequences

- Skopiowanie folderu aplikacji na inny PC nie przenosi aktywnej sesji.
- Ten sam Windows user na tej samej maszynie = ta sama `device_id` (wygodne).
- Inny Windows user na tym samym PC = inny `machine_id` (bezpieczne przy wspolnym stanowisku).
- Wspolna baza na NAS: kazdy PC ma wlasne wiersze `device_sessions`.

## Related

- ADR-007 (SQLite w repo)
- ADR-006 (Entra / LDAP - docelowo; lokalne konta zostaja jako fallback)
