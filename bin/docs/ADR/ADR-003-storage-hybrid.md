# ADR-003 - Storage hybrid

Status: Accepted  
Date: 2026-07-16

## Decision

Istniejace drzewa POLSKA = pointery read-only (M:/D:). Nowe uploady = `P:\DAM\storage\`.

## Consequences

Ingest nie kopiuje TB danych na start. Brak zapisu projektu poza P (poza wskazaniem pointera).
