# ADR-002 - Dwie osie wersjonowania

Status: Accepted  
Date: 2026-07-16

## Decision

- Os A: `variants` (produkt / nosnik / indeks.rewizja)
- Os B: `asset_revisions` + `assets.current_revision_id`

Stara rewizja nie moze oznaczac checklisty jako kompletnej, jesli nie jest `current`.

## Consequences

Completeness zawsze patrzy na current revision per wymagany asset_role.
