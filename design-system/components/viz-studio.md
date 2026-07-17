# Viz Studio (explorer)

## Intent

Replace the dense L/S/format badge wall with:
1. Background tabs (**Z tlem** / **Bez tla**)
2. One **hero** preview per perspective
3. Click-through **studio lightbox** (sidebar variants + meta + zoom + view nav)

## Tokens

- Primary active chips: `var(--primary-color, #AB54DB)`
- Stage background: `#111318`
- Sidebar surface: `#f7f6fa`
- Touch targets: min 36-44px (`.dam-lb-tool`, `.dam-lb-chip`, `.dam-viz-bg-tab`)

## Classes

| Class | Role |
|-------|------|
| `.dam-viz-studio` | Root hero gallery |
| `.dam-viz-bg-tabs` / `.dam-viz-bg-tab` | Background filter |
| `.dam-viz-hero` | One perspective card |
| `.dam-lightbox--studio` | Studio modal |
| `.dam-lightbox__side` / `__main` / `__stage` | Layout |
| `.dam-lb-tool` | Zoom / prev / next |
| `.dam-lb-variant` | L/S/format option row |

## Bridge

`GET http://127.0.0.1:8766/media-meta?path=` -> resolution, weight, colorspace, dpi.

## Rules

- No em-dash in UI strings.
- Prefer real product thumbs (`/media` + `data/thumbs`), never invent carrier types.
- Hints: `DamLabels.vizSizeHint` / `vizFormatHint`.
