-- ADR-012 punkt 2: bramka "jeden wlasciciel wspolnego katalogu" po stronie bazy.
-- Dziala takze na stare wersje aplikacji (sprzed 27.09), ktore nie znaja
-- dam_meta.index_authority.
--
-- Idempotentny: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS / CREATE TRIGGER.
-- Ponowne wykonanie tego pliku WLACZA wyzwalacze z powrotem (tworzy je od nowa),
-- takze po `ALTER TABLE ... DISABLE TRIGGER` z --rollback.
--
-- Aktywna tylko, gdy dam_meta['index_authority'] = {"machines": [...]} ma niepusta
-- liste. Brak klucza / pusta lista / zly JSON = bramka nieaktywna (wszystko jak dotad;
-- zly JSON dodatkowo RAISE WARNING - skrypt enable-index-authority.py zapisuje tylko
-- poprawny JSON).
--
-- Nazwa maszyny = lower(split_part(pole, ':', 1)): dam_assets.updated_by
-- (asset_sync: COMPUTERNAME; repair-dam-assets-collisions.py: "<host>:repair"),
-- dam_index_snapshots.built_by (index_snapshots._machine() = COMPUTERNAME).
--
-- Odrzucenie (runda 2, decyzja kierownika 28.09):
--   dam_assets          - RETURN NULL: pomijany jest TYLKO ten wiersz (RETURNING nic nie
--                         zwraca = "nie zastosowano", jak warunki WHERE w _SQL_TOMBSTONE /
--                         _SQL_RESTORE); reszta paczki push_ops, w tym INSERT nowych plikow,
--                         przechodzi. Kazda odmowa trafia do dam_authority_rejects.
--   dam_index_snapshots - RAISE EXCEPTION (SQLSTATE P0001, komunikat od "dam_not_authority:"):
--                         jeden klucz na zapis, klient (index_snapshots.publish_changed) lapie
--                         wyjatek jako "skipped: not_authority". Wpisu w dam_authority_rejects
--                         dla migawek NIE ma - INSERT przed RAISE zostalby wycofany razem z
--                         transakcja; slad zostaje w komunikacie bledu (log klienta i serwera).
--
-- Funkcje sa tworzone w pierwszym schemacie search_path i zapamietuja search_path
-- z chwili utworzenia (SET search_path FROM CURRENT): na produkcji "$user", public;
-- w testach (realpg.fresh_db) t_<losowy>, public - kazdy test ma wlasna kopie
-- i czyta dam_meta ze swojego schematu.
--
-- Wycofanie (bin/scripts/ops/enable-index-authority.py --rollback):
--   index_authority.machines = []  +  ALTER TABLE ... DISABLE TRIGGER dam_authority_gate_*
-- (bez DROP).

-- Dziennik odmow dam_assets. Jeden wiersz na (tabela, maszyna, asset_id, powod) -
-- powtorki licza sie w `hits` / `last_at`, zeby stary klient powtarzajacy te sama
-- operacje co cykl (np. falszywe "meta" z 2.4.5) nie rozdmuchal tabeli.
CREATE TABLE IF NOT EXISTS dam_authority_rejects (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  table_name text NOT NULL,
  machine text NOT NULL DEFAULT '',
  asset_id text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  hits bigint NOT NULL DEFAULT 1,
  last_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS dam_authority_rejects_key_idx
  ON dam_authority_rejects (table_name, machine, asset_id, reason);
CREATE INDEX IF NOT EXISTS dam_authority_rejects_last_idx ON dam_authority_rejects (last_at);

CREATE OR REPLACE FUNCTION dam_authority_machines()
RETURNS text[]
LANGUAGE plpgsql
STABLE
SET search_path FROM CURRENT
AS $fn$
DECLARE
  raw text;
  doc jsonb;
  result text[];
BEGIN
  BEGIN
    SELECT value INTO raw FROM dam_meta WHERE key = 'index_authority';
  EXCEPTION WHEN undefined_table THEN
    RETURN ARRAY[]::text[];
  END;
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN ARRAY[]::text[];
  END IF;
  BEGIN
    doc := raw::jsonb;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'dam_authority: dam_meta.index_authority nie jest poprawnym JSON - bramka nieaktywna';
    RETURN ARRAY[]::text[];
  END;
  IF jsonb_typeof(doc) IS DISTINCT FROM 'object'
     OR jsonb_typeof(doc -> 'machines') IS DISTINCT FROM 'array' THEN
    RETURN ARRAY[]::text[];
  END IF;
  SELECT coalesce(array_agg(lower(btrim(m))) FILTER (WHERE btrim(m) <> ''), ARRAY[]::text[])
    INTO result
    FROM jsonb_array_elements_text(doc -> 'machines') AS m;
  RETURN result;
END
$fn$;

CREATE OR REPLACE FUNCTION dam_authority_machine_of(who text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT lower(btrim(split_part(coalesce(who, ''), ':', 1)))
$fn$;

-- dam_index_snapshots: zapis (INSERT i UPDATE, takze ON CONFLICT DO UPDATE z
-- pg_db.publish_index_snapshot) tylko, gdy built_by jest na liscie.
CREATE OR REPLACE FUNCTION dam_authority_gate_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $fn$
DECLARE
  allowed text[] := dam_authority_machines();
  who text;
BEGIN
  IF cardinality(allowed) = 0 THEN
    RETURN NEW;
  END IF;
  who := dam_authority_machine_of(NEW.built_by);
  IF who = ANY (allowed) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION USING
    ERRCODE = 'P0001',
    MESSAGE = format('dam_not_authority: migawka %s od %s odrzucona (poza lista index_authority)',
                     NEW.store_key, coalesce(NULLIF(NEW.built_by, ''), '(pusty built_by)')),
    HINT = 'ADR-012: migawki indeksu publikuje tylko komputer z dam_meta.index_authority.machines';
END
$fn$;

-- dam_assets: maszyna spoza listy moze tylko:
--   INSERT (nowy plik) - brak wyzwalacza na INSERT,
--   UPDATE zywego wiersza na SCISLE nowszy mtime_ms (i wiersz zostaje zywy).
-- Tombstone, przywrocenie (restore/recreate), zmiana przy tym samym mtime - pominiete
-- (RETURN NULL) i zapisane w dam_authority_rejects.
-- UPDATE z ON CONFLICT DO UPDATE ... WHERE <falsz> nie wywoluje wyzwalacza
-- (wiersz nie jest aktualizowany), wiec odmowy z asset_sync._SQL_UPSERT
-- ("starszy mtime nigdy nie wygrywa") dzialaja jak dotad i nie sa logowane.
CREATE OR REPLACE FUNCTION dam_authority_gate_assets()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $fn$
DECLARE
  allowed text[] := dam_authority_machines();
  who text;
  why text;
BEGIN
  IF cardinality(allowed) = 0 THEN
    RETURN NEW;
  END IF;
  who := dam_authority_machine_of(NEW.updated_by);
  IF who = ANY (allowed) THEN
    RETURN NEW;
  END IF;
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL
     AND NEW.mtime_ms > OLD.mtime_ms THEN
    RETURN NEW;
  END IF;
  why := CASE
           WHEN OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN 'usuniecie'
           WHEN OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN 'przywrocenie'
           WHEN OLD.deleted_at IS NOT NULL THEN 'wiersz_usuniety'
           ELSE 'mtime_nie_nowszy'
         END;
  INSERT INTO dam_authority_rejects AS r (table_name, machine, asset_id, reason)
  VALUES (TG_TABLE_NAME, split_part(coalesce(NEW.updated_by, ''), ':', 1), coalesce(OLD.asset_id, ''), why)
  ON CONFLICT (table_name, machine, asset_id, reason)
  DO UPDATE SET hits = r.hits + 1, last_at = now();
  RETURN NULL;  -- pomin ten wiersz; reszta instrukcji / paczki idzie dalej
END
$fn$;

DROP TRIGGER IF EXISTS dam_authority_gate_snapshots ON dam_index_snapshots;
CREATE TRIGGER dam_authority_gate_snapshots
  BEFORE INSERT OR UPDATE ON dam_index_snapshots
  FOR EACH ROW EXECUTE FUNCTION dam_authority_gate_snapshots();

DROP TRIGGER IF EXISTS dam_authority_gate_assets ON dam_assets;
CREATE TRIGGER dam_authority_gate_assets
  BEFORE UPDATE ON dam_assets
  FOR EACH ROW EXECUTE FUNCTION dam_authority_gate_assets();
