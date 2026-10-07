-- ETAP 0 synchronizacji (07.10.2026): tetno komputerow i rejestr komputerow z M:.
--
-- URUCHAMIA WLASCICIEL (konto dam_eta), nie program: od wydania 2.6.1 program NIE wysyla
-- zadnego DDL dla tych obiektow. Bez tego pliku program dziala jak 2.6.0: tetno po cichu
-- pomija zapis (jedna linia ostrzezenia w logu, nic wiecej), rejestr M: odpowiada "kopia".
--
-- Idempotentny (IF NOT EXISTS / OR REPLACE), BEZ BEGIN/COMMIT w srodku - uruchom jako jedna transakcja:
--   psql -v ON_ERROR_STOP=1 --single-transaction -f fleet.sql
-- Nazwy bez schematu (kontrakt test_pg_regclass_search_path.py): trafiaja w pierwszy schemat
-- search_path polaczenia; funkcja zapamietuje search_path z chwili utworzenia.
--
-- Czas wylacznie z zegara bazy (now()). Klient podaje swoj czas tylko do policzenia
-- przesuniecia zegara (clock_skew_s), nigdy do kolejnosci zdarzen.
--
-- Wylacznik tetna bez wydania i bez DROP (klient sprawdza przy kazdym tetnie, najpozniej po ok. 5 min):
--   INSERT INTO dam_meta (key, value) VALUES ('fleet_heartbeat', 'off')
--     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
-- Ponowne wlaczenie: value = 'on' (albo DELETE FROM dam_meta WHERE key = 'fleet_heartbeat').
-- Cofniecie zatwierdzenia komputera: UPDATE dam_m_computers SET state = 'revoked' WHERE machine = '...';
-- Tabel nie kasujemy (dane pomocnicze, zadna regula jeszcze z nich nie korzysta).
--
-- Rzeczy poza ta tabela: lista adresow udzialu M: to dam_meta['m_shares'] (JSON, tworzy ja ekran
-- admina albo POST /fleet/m-register), bez nowego DDL.

-- Tetno klienta: JEDEN wiersz na komputer (ostatni stan). Brak historii (swiadomie).
CREATE TABLE IF NOT EXISTS dam_client_heartbeat (
  machine           text PRIMARY KEY,                    -- lower(btrim(split_part(COMPUTERNAME,':',1))), jak dam_authority_machine_of()
  machine_name      text NOT NULL DEFAULT '',            -- COMPUTERNAME w oryginalnej wielkosci liter, do wyswietlania
  windows_user      text NOT NULL DEFAULT '',
  dam_user          text NOT NULL DEFAULT '',            -- e-mail zalogowanego uzytkownika DAM z sesji (moze byc pusty)
  app_version       text NOT NULL DEFAULT '',            -- runtime_config.APP_VERSION
  proto             integer NOT NULL DEFAULT 1,          -- wersja formatu tetna; klient bez tetna nie ma wiersza
  platform          text NOT NULL DEFAULT '',            -- win32 | darwin | linux
  data_mode         text NOT NULL DEFAULT '',            -- live | local (data_mode.py)
  catalog_kind      text NOT NULL DEFAULT '',            -- snapshot (etap 0) | generation (etap 3)
  catalog_id        text NOT NULL DEFAULT '',            -- znacznik katalogu: 7 znakow (etap 0) albo numer kompletu jako tekst (etap 3)
  catalog_gen       bigint,                              -- numer kompletu (etap 3), do tego czasu NULL
  catalog_built_at  text NOT NULL DEFAULT '',            -- ISO, z migawki/kompletu
  catalog_source    text NOT NULL DEFAULT '',            -- db | local | mixed
  catalog_pulled_at text NOT NULL DEFAULT '',
  assets_rev        bigint,                              -- najwyzszy rev wierszy materialow pobrany lokalnie (etap 1; do tego czasu NULL)
  missing_marked    integer,                             -- ile plikow ma teraz "brakuje od" (etap 1a; NULL do tego czasu)
  holds             integer,                             -- ile folderow jest wstrzymanych miekko (etap 1a; NULL do tego czasu)
  witness_tripped   boolean,                             -- czy zadzialal swiadek "caly udzial niedostepny" (etap 1a; NULL do tego czasu)
  root_kind         text NOT NULL DEFAULT 'none',        -- none | remote | fixed | removable | unknown
  root_drive        text NOT NULL DEFAULT '',            -- 'M:' albo '' (ROOT jako UNC bez litery)
  root_share        text NOT NULL DEFAULT '',            -- klucz ROOT: pelny UNC folderu ROOT, a gdy ROOT nie jest dyskiem sieciowym (albo UNC nie do ustalenia) pelna znormalizowana sciezka lokalna; male litery, ukosniki w przod, bez koncowego
  root_state        text NOT NULL DEFAULT 'none',        -- full | partial | none (local_bridge._root_state)
  m_role            text NOT NULL DEFAULT 'copy',        -- m | copy (m_computers.role_for_root)
  m_state           text NOT NULL DEFAULT 'none',        -- approved | pending | revoked | none
  clock_skew_s      double precision,                    -- zegar klienta minus zegar bazy, sekundy (liczone w SQL)
  started_at        timestamptz,                         -- start procesu mostu (czas bazy w chwili pierwszego tetna procesu)
  last_error        text NOT NULL DEFAULT '',            -- ostatni blad cyklu migawek/tetna, max 300 znakow
  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  seen_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dam_client_heartbeat_machine_norm CHECK (machine = lower(btrim(machine)) AND machine <> '')
);
CREATE INDEX IF NOT EXISTS dam_client_heartbeat_seen_idx ON dam_client_heartbeat (seen_at);
-- Kolumny dopisane po wydaniu (tabela mogla powstac wczesniej): zawsze ADD COLUMN IF NOT EXISTS, tylko dopisywanie.
ALTER TABLE dam_client_heartbeat ADD COLUMN IF NOT EXISTS missing_marked integer;
ALTER TABLE dam_client_heartbeat ADD COLUMN IF NOT EXISTS holds integer;
ALTER TABLE dam_client_heartbeat ADD COLUMN IF NOT EXISTS witness_tripped boolean;

-- Rejestr komputerow z M: (para komputer + dysk). Zatwierdza admin; klient zglasza sie sam jako 'pending'.
CREATE TABLE IF NOT EXISTS dam_m_computers (
  machine      text NOT NULL,
  drive        text NOT NULL DEFAULT '',                 -- 'M:' (wielka litera + dwukropek) albo '' dla ROOT jako UNC
  share        text NOT NULL DEFAULT '',                 -- klucz ROOT znormalizowany jak root_share
  state        text NOT NULL DEFAULT 'pending',
  source       text NOT NULL DEFAULT 'auto',             -- auto = zglosil sie sam; admin = dopisal admin (dysk domowy, RaiDrive)
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz,
  decided_by   text NOT NULL DEFAULT '',
  note         text NOT NULL DEFAULT '',
  PRIMARY KEY (machine, drive),
  CONSTRAINT dam_m_computers_machine_norm CHECK (machine = lower(btrim(machine)) AND machine <> '' AND position(':' in machine) = 0),
  CONSTRAINT dam_m_computers_share_norm   CHECK (share = lower(share) AND position(E'\\' in share) = 0 AND share !~ '/$'),
  CONSTRAINT dam_m_computers_state        CHECK (state IN ('pending','approved','revoked')),
  CONSTRAINT dam_m_computers_source       CHECK (source IN ('auto','admin'))
);

-- Jedyne wywolanie, z ktorego maja korzystac wyzwalacze etapu 1a/4 (zamiast czytac tabele).
-- STABLE, bez cache po stronie bazy: 'revoked' dziala od nastepnego zapisu.
-- Przyjmuje updated_by w formie 'HOST' albo 'HOST:sufiks'.
-- CREATE OR REPLACE robi tylko ten skrypt (wlasciciel), nigdy klient programu.
CREATE OR REPLACE FUNCTION dam_is_m_computer(who text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path FROM CURRENT
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM dam_m_computers
    WHERE machine = lower(btrim(split_part(coalesce(who, ''), ':', 1)))
      AND state = 'approved'
  )
$fn$;
