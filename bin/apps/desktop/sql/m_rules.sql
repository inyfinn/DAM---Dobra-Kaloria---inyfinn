-- Etap 1a, krok K3: reguly zapisu do dam_assets ("komputer z M:" kontra "kopia" / stary klient).
-- Wersja 4 (07.10.2026, po przegladzie krytyka P1, P3, P5, P9 i decyzji Q1: hamulec liczy 2 % z dokladnej liczby wierszy). Sprawdzona na bazie TESTOWEJ dam_eta_test
-- (work/2026-10-07/etap1/), NIE WYKONANA na produkcji. Docelowe miejsce w repo: bin/apps/desktop/sql/m_rules.sql.
-- Wykonuje WYLACZNIE skrypt administratora (enable-m-rules.py). Klient nigdy nie robi CREATE OR REPLACE.
--
-- Wymaga: sql/authority_gate.sql (dam_authority_machines, dam_authority_machine_of, dam_authority_rejects)
--         etap 0: funkcja dam_is_m_computer(text) (sql/fleet.sql)
--         01-kolumny.sql
--
-- Przelacznik: dam_meta['m_rules'] = {"mode": "off"|"shadow"|"on", "proto": 1, "confirm_ms": 90000, "hold_ms": 900000,
--                                     "batch_max_files": 1000, "batch_max_share": 0.02}
--   brak wiersza / zly JSON / "off"  -> DOKLADNIE dam_authority_gate_assets (ADR-012): INSERT bez zmian, UPDATE ten sam werdykt
--   "shadow"                         -> werdykty jak "off"; dodatkowo komputer z M: moze zmieniac kolumny etapu 1a,
--                                       a nowe wiersze spoza M: dostaja origin 'copy'
--   "on"                             -> nowe reguly (spec/etap-1.md, rozdzial 3.2)
--
-- Kto pisze: nowy klient po kazdym BEGIN wykonuje  SELECT set_config('dam.writer', 'HOST:m1', true)
--   (komputer z M:) albo 'HOST:c1' (kopia). Trzeci argument MUSI byc true (zmienna lokalna dla transakcji).
--   Stary klient nie ustawia nic -> dla bazy jest "kopia". Zapis "z M:" = sufiks ^m[0-9]+$ AND dam_is_m_computer().
--
-- Idempotentny. Ponowne wykonanie zostawia jeden wyzwalacz dam_assets_rules i zadnego dam_authority_gate_assets.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION dam_m_rules()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path FROM CURRENT
AS $fn$
DECLARE
  raw text;
BEGIN
  BEGIN
    SELECT value INTO raw FROM dam_meta WHERE key = 'm_rules';
  EXCEPTION WHEN undefined_table THEN
    RETURN '{}'::jsonb;
  END;
  IF raw IS NULL OR btrim(raw) = '' THEN
    RETURN '{}'::jsonb;
  END IF;
  BEGIN
    RETURN raw::jsonb;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'dam_m_rules: dam_meta.m_rules nie jest poprawnym JSON - reguly wylaczone';
    RETURN '{}'::jsonb;
  END;
END
$fn$;

-- Dokladna liczba zywych wierszy katalogu, zapisywana przez klienta raz na dobe i przez narzedzie uzgodnienia
-- (instrukcja M17): dam_meta['m_catalog_count'] = {"live": N, "at_ms": ..., "by": ...}. NULL = nie zapisano.
-- Odczyt wyrazeniem regularnym, nie rzutowaniem na jsonb: zepsuty wpis nie moze wywracac zapisow.
CREATE OR REPLACE FUNCTION dam_m_catalog_live()
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path FROM CURRENT
AS $fn$
DECLARE
  raw text;
BEGIN
  BEGIN
    SELECT value INTO raw FROM dam_meta WHERE key = 'm_catalog_count';
  EXCEPTION WHEN undefined_table THEN
    RETURN NULL;
  END;
  RETURN substring(coalesce(raw, '') from '"live"\s*:\s*([0-9]{1,12})')::numeric;
END
$fn$;

CREATE OR REPLACE FUNCTION dam_assets_reject(p_machine text, p_asset text, p_reason text)
RETURNS void
LANGUAGE sql
SET search_path FROM CURRENT
AS $fn$
  INSERT INTO dam_authority_rejects AS r (table_name, machine, asset_id, reason)
  VALUES ('dam_assets', coalesce(p_machine, ''), coalesce(p_asset, ''), p_reason)
  ON CONFLICT (table_name, machine, asset_id, reason)
  DO UPDATE SET hits = r.hits + 1, last_at = now()
$fn$;

CREATE OR REPLACE FUNCTION dam_assets_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $fn$
DECLARE
  cfg jsonb := dam_m_rules();
  mode text := coalesce(NULLIF(cfg ->> 'mode', ''), 'off');
  confirm_ms bigint := CASE WHEN cfg ->> 'confirm_ms' ~ '^[0-9]{1,9}$'
                            THEN (cfg ->> 'confirm_ms')::bigint ELSE 90000 END;  -- zly wpis nie moze wywracac zapisow
  max_files bigint := CASE WHEN cfg ->> 'batch_max_files' ~ '^[0-9]{1,9}$'
                           THEN (cfg ->> 'batch_max_files')::bigint ELSE 1000 END;
  max_share numeric := CASE WHEN cfg ->> 'batch_max_share' ~ '^(0(\.[0-9]{1,6})?|1(\.0{1,6})?)$'
                            THEN (cfg ->> 'batch_max_share')::numeric ELSE 0.02 END;
  w text := coalesce(current_setting('dam.writer', true), '');
  who text := dam_authority_machine_of(NEW.updated_by);
  allowed text[] := dam_authority_machines();
  is_m boolean := false;
  on_list boolean;
  now_ms bigint := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  del boolean;
  undel boolean;
  legacy_ok boolean;
  in_mtime bigint;
  in_size bigint;
  in_rev bigint;
  in_batch bigint;
  catalog numeric;
  why text := '';
BEGIN
  IF mode NOT IN ('off', 'shadow', 'on') THEN
    mode := 'off';
  END IF;

  -- ------------------------------------------------------------------ tryb off: dokladnie stara bramka (P9)
  IF mode = 'off' AND TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF w <> '' THEN
    who := dam_authority_machine_of(w);
  END IF;
  IF mode <> 'off' THEN
    IF split_part(w, ':', 2) ~ '^m[0-9]+$' THEN
      is_m := dam_is_m_computer(w);          -- zagniezdzone celowo: przy "off" funkcja etapu 0 nie jest wolana
    END IF;
  END IF;
  on_list := cardinality(allowed) = 0 OR who = ANY (allowed);

  -- ------------------------------------------------------------------ INSERT (shadow, on)
  IF TG_OP = 'INSERT' THEN
    IF is_m THEN
      RETURN NEW;                            -- komputer z M: ustawia origin/master_* sam (instrukcja M1)
    END IF;
    IF mode = 'on' AND NEW.mtime_ms > now_ms + 300000 THEN
      PERFORM dam_assets_reject(who, NEW.asset_id, 'data_z_przyszlosci');
      RETURN NULL;
    END IF;
    NEW.origin := 'copy';                    -- "jeszcze nie na M:"
    NEW.master_seen_ms := NULL;              -- zapis spoza M: nie zostawia sladu "widziane na M:"
    NEW.master_mtime := NULL;
    NEW.master_size := NULL;
    NEW.missing_since_ms := NULL;
    NEW.checked_ms := NULL;
    NEW.delete_batch := NULL;
    NEW.author_by := who;
    NEW.author_mtime := NEW.mtime_ms;
    NEW.author_size := NEW.size;
    NEW.author_seen_ms := now_ms;
    RETURN NEW;
  END IF;

  del := OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL;
  undel := OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL;

  -- ------------------------------------------------------------------ UPDATE bez zmiany tresci (shadow, on)
  -- Stempel "widziane na M:", "brakuje od", "sprawdzony o", zajecie do sondy. Moze zmienic rev (przejscie copy -> m).
  -- Od kogokolwiek innego taka zmiana jest odrzucana - to jedyna roznica trybu shadow wobec starej bramki.
  IF mode <> 'off'
     AND (NEW.asset_key, NEW.path_rel, NEW.name, NEW.size, NEW.mtime_ms, NEW.content_hash, NEW.meta, NEW.deleted_at)
         IS NOT DISTINCT FROM
         (OLD.asset_key, OLD.path_rel, OLD.name, OLD.size, OLD.mtime_ms, OLD.content_hash, OLD.meta, OLD.deleted_at) THEN
    IF is_m THEN
      RETURN NEW;
    END IF;
    PERFORM dam_assets_reject(who, OLD.asset_id, 'kolumny_m_spoza_m');
    RETURN NULL;
  END IF;

  -- ------------------------------------------------------------------ werdykt starej bramki (off, shadow)
  IF mode <> 'on' THEN
    -- dokladnie warunki dam_authority_gate_assets (authority_gate.sql:143-159)
    legacy_ok := cardinality(allowed) = 0
                 OR dam_authority_machine_of(NEW.updated_by) = ANY (allowed)
                 OR (OLD.deleted_at IS NULL AND NEW.deleted_at IS NULL AND NEW.mtime_ms > OLD.mtime_ms);
    IF NOT legacy_ok THEN
      why := CASE
               WHEN del THEN 'usuniecie'
               WHEN undel THEN 'przywrocenie'
               WHEN OLD.deleted_at IS NOT NULL THEN 'wiersz_usuniety'
               ELSE 'mtime_nie_nowszy'
             END;
      PERFORM dam_assets_reject(split_part(coalesce(NEW.updated_by, ''), ':', 1), OLD.asset_id, why);
      RETURN NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- ------------------------------------------------------------------ on, komputer z M:
  IF is_m THEN
    -- Dodanie, zmiana (takze na starsza date) i opis: zawsze.
    IF (del OR undel) AND NOT on_list THEN
      why := CASE WHEN del THEN 'usuniecie_spoza_listy' ELSE 'przywrocenie_spoza_listy' END;  -- zdejmuje etap 4
    ELSIF del AND OLD.origin = 'copy' THEN
      why := 'usuniecie_wpisu_kopii';        -- wpis "tylko z kopii" nie znika dlatego, ze nie ma go na M:
    ELSIF del AND NEW.delete_batch IS NULL THEN
      why := 'usuniecie_bez_partii';         -- kazde usuniecie musi dac sie cofnac partia
    ELSIF del AND OLD.origin IS NULL AND NEW.delete_batch NOT LIKE 'r-%' THEN
      why := 'usuniecie_wiersza_sprzed_1a';  -- P1: wiersze nierozstrzygniete usuwa tylko narzedzie uzgodnienia (partia r-)
    ELSIF del AND (OLD.missing_since_ms IS NULL OR OLD.missing_since_ms > now_ms - confirm_ms) THEN
      why := 'usuniecie_bez_drugiego_sprawdzenia';
    ELSIF del AND NEW.delete_batch NOT LIKE 'r-%' THEN
      -- P3: hamulec. Partia zwyklej pracy nie moze przekroczyc max_files ani max_share katalogu.
      SELECT count(*) INTO in_batch FROM dam_assets
       WHERE delete_batch = NEW.delete_batch AND deleted_at IS NOT NULL;
      catalog := dam_m_catalog_live();       -- dokladna liczba z dam_meta (M17); brak wpisu = obowiazuje sam limit plikow
      IF in_batch >= max_files
         OR (coalesce(catalog, 0) > 0 AND in_batch >= GREATEST(1, floor(catalog * max_share))) THEN
        why := 'partia_za_duza';
      END IF;
    END IF;
    IF why <> '' THEN
      PERFORM dam_assets_reject(who, OLD.asset_id, why);
      RETURN NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- ------------------------------------------------------------------ on, kopia albo stary klient (takze z listy index_authority)
  IF del OR undel OR OLD.deleted_at IS NOT NULL THEN
    why := CASE WHEN del THEN 'usuniecie' WHEN undel THEN 'przywrocenie' ELSE 'wiersz_usuniety' END;
  ELSIF NOT (NEW.mtime_ms > OLD.mtime_ms) THEN
    why := 'mtime_nie_nowszy';
  ELSIF NEW.mtime_ms > now_ms + 300000 THEN
    why := 'data_z_przyszlosci';
  END IF;
  IF why <> '' THEN
    PERFORM dam_assets_reject(who, OLD.asset_id, why);
    RETURN NULL;
  END IF;

  IF OLD.origin = 'm' THEN
    -- Dane z M: zostaja. Obok zapis "nowsza wersja u autora" (N2).
    IF (OLD.author_mtime, OLD.author_size, OLD.author_by) IS NOT DISTINCT FROM (NEW.mtime_ms, NEW.size, who) THEN
      RETURN NULL;                           -- to samo zgloszenie co poprzednio: bez zapisu i bez wpisu w dzienniku
    END IF;
    in_mtime := NEW.mtime_ms;
    in_size := NEW.size;
    in_rev := NEW.rev;
    NEW := OLD;
    NEW.author_mtime := in_mtime;
    NEW.author_size := in_size;
    NEW.author_by := who;
    NEW.author_seen_ms := now_ms;
    NEW.rev := in_rev;                       -- nowy rev: pozostale komputery pobiora informacje
    RETURN NEW;
  END IF;

  -- wiersz "tylko z kopii" albo sprzed 1a: nowsza data przechodzi jak dotad, plus podpis autora.
  -- Kolumny "widziane na M:" zostaja takie, jakie byly (takze gdy pisze instrukcja M1 od komputera niezatwierdzonego).
  NEW.origin := OLD.origin;
  NEW.master_seen_ms := OLD.master_seen_ms;
  NEW.master_mtime := OLD.master_mtime;
  NEW.master_size := OLD.master_size;
  NEW.missing_since_ms := OLD.missing_since_ms;
  NEW.checked_ms := OLD.checked_ms;
  NEW.delete_batch := OLD.delete_batch;
  NEW.author_by := who;
  NEW.author_mtime := NEW.mtime_ms;
  NEW.author_size := NEW.size;
  NEW.author_seen_ms := now_ms;
  RETURN NEW;
END
$fn$;

-- Jeden wyzwalacz zamiast dam_authority_gate_assets (funkcja dam_authority_gate_assets ZOSTAJE - sluzy wycofaniu).
DROP TRIGGER IF EXISTS dam_authority_gate_assets ON dam_assets;
DROP TRIGGER IF EXISTS dam_assets_rules ON dam_assets;
CREATE TRIGGER dam_assets_rules
  BEFORE INSERT OR UPDATE ON dam_assets
  FOR EACH ROW EXECUTE FUNCTION dam_assets_rules();

-- Klucz przelacznika powstaje wylaczony. Wlaczenie to osobny, swiadomy krok (K5, K6).
INSERT INTO dam_meta (key, value)
VALUES ('m_rules', '{"mode": "off", "proto": 1, "confirm_ms": 90000, "hold_ms": 900000, "batch_max_files": 1000, "batch_max_share": 0.02}')
ON CONFLICT (key) DO NOTHING;

COMMIT;
