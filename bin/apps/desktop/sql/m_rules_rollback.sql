-- Etap 1a: wycofanie kroku K3 (reguly) do stanu sprzed etapu 1a.
-- Wersja 2 (07.10.2026, P8). Sprawdzone na bazie TESTOWEJ, NIE WYKONANE na produkcji.
-- Bez DROP funkcji i bez DROP kolumn: po wykonaniu baza zachowuje sie jak przed K3, a dane etapu 1a zostaja.
--
-- Poziomy powrotu (od najlzejszego):
--   1. Sam przelacznik (dziala takze, gdy wiersza nie ma albo jego JSON jest zepsuty):
--        INSERT INTO dam_meta (key, value) VALUES ('m_rules', '{"mode":"off"}')
--        ON CONFLICT (key) DO UPDATE SET value = '{"mode":"off"}';
--      -> natychmiast, bez zmiany wyzwalaczy; nowy klient wraca do starych instrukcji w nastepnym cyklu (<= 60 s).
--   2. Ten skrypt: stary wyzwalacz ADR-012 z powrotem, nowy zdjety.
--   3. Cofniecie partii usuniec: bin/scripts/ops/reconcile-catalog-with-m.py --undo <partia> (jedna instrukcja UPDATE;
--      wymaga trybu "on" i komputera z rejestru M: bedacego na liscie index_authority - dlatego PRZED poziomem 1).

BEGIN;
SET LOCAL lock_timeout = '5s';

INSERT INTO dam_meta (key, value) VALUES ('m_rules', '{"mode":"off"}')
ON CONFLICT (key) DO UPDATE SET value = '{"mode":"off"}';

DROP TRIGGER IF EXISTS dam_assets_rules ON dam_assets;
DROP TRIGGER IF EXISTS dam_authority_gate_assets ON dam_assets;
CREATE TRIGGER dam_authority_gate_assets
  BEFORE UPDATE ON dam_assets
  FOR EACH ROW EXECUTE FUNCTION dam_authority_gate_assets();

COMMIT;
