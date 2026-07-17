# DOMAIN - DAM ETA

## Encje

- **Project** - produkt / indeks (np. `6300729.00`)
- **Variant** - nosnik + data + rewizja indeksu (os A)
- **Asset** - plik logiczny z `current_revision_id`
- **AssetRevision** - konkretny blob / pointer (os B)
- **ChecklistTemplate** + items - schemat DK/GC
- **ChecklistStatus** - materializacja kompletnosci per variant
- **User** - `role`: admin | power_user | user
- **IntegrationLink** - Asana task id / Teams conversation ref

## Sloty POLSKA (pointery)

| Slot folder | asset_role |
|-------------|------------|
| 0 - ARCHIWUM | archive |
| 1 - ARTWORK | artwork |
| 2 - WIZUALIZACJE | viz_3d |
| 3 - DO DRUKU | print_pdf |
| 4 - TECHNOLOGIA | tech |

## Role aplikacji

| Role | Moze |
|------|------|
| admin | users, auth providers, integracje, storage, audit |
| power_user | projekty, upload, checklist, Asana/Teams ops |
| user | read, download, wlasne zadania |
