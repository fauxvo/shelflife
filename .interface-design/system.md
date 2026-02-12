# Shelflife Design System

## Direction

Neutral-cool cinema. A Plex-adjacent media library tool with a clean dark mode — slightly cool, cinematic. The content (posters, titles) is the star; the interface recedes behind it. Plex gold brand accent provides warmth against neutral-cool surfaces.

**Who:** Plex server admin and their friends/family. Home, evening, managing shared media storage.
**Task:** Browse a media collection, vote on what stays/goes, admin triages community input.
**Feel:** Clean dark mode with a subtle slate undertone. Not blue-cold like Tailwind defaults, not brown-warm. Proper calibrated dark.

## Domain Concepts

- **Shelf** — finite space, physical constraint
- **Expiration / freshness** — unwatched content gets stale
- **Curation** — shaping a collection, not just deleting files
- **Home theater** — dark room, poster art
- **Triage** — assess, prioritize, decide
- **Community lending library** — shared space, democratic voice

## Color

### Neutral-Cool Gray Scale (overrides Tailwind's blue-gray)

Defined in `globals.css` via `@theme`. Subtle slate undertone without Tailwind's strong blue tint. Every `bg-gray-*`, `text-gray-*`, `border-gray-*` class automatically uses these.

| Token    | Value     | Role                                             |
| -------- | --------- | ------------------------------------------------ |
| gray-950 | `#0b0c0e` | Canvas / body background                         |
| gray-900 | `#15171a` | Card surfaces                                    |
| gray-800 | `#232629` | Borders, control backgrounds, poster placeholder |
| gray-700 | `#36393e` | Hover states on secondary controls               |
| gray-600 | `#4d5157` | Muted borders, dividers                          |
| gray-500 | `#696e75` | Tertiary text, metadata labels                   |
| gray-400 | `#949a9f` | Secondary text                                   |
| gray-300 | `#bec3c8` | —                                                |
| gray-200 | `#d7dbe0` | Emphasis text in context                         |
| gray-100 | `#ebedf0` | Primary body text                                |
| gray-50  | `#f5f7f8` | Maximum emphasis text                            |

### Semantic Color Overrides (all scales in `globals.css`)

All semantic colors are overridden in `@theme` to be desaturated ~30-35% from Tailwind defaults. This prevents bright neon accents from clashing with the neutral-cool gray palette. The full scales (50–950) are defined for: red, green, blue, purple, yellow, orange, amber.

Key principle: **desaturate, don't just darken.** Colors should still read as their hue but sit comfortably on the dark surfaces without screaming.

- **Red** — Velvet, not fire engine. `red-600: #943f3c` for buttons, `red-400: #c07e7b` for text.
- **Green** — Patina, not neon. `green-600: #458267` for buttons, `green-400: #6ba888` for text.
- **Blue** — Softer, less electric. `blue-600: #3b6396` for TV badge, `blue-300: #8cafd1` for text.
- **Purple** — Muted. `purple-300: #b09ecc` for Watched badge text.
- **Yellow** — Less acidic. `yellow-300: #ccb87a` for partial status text.
- **Orange** — Softer. `orange-300: #cca87a` for pending status text.
- **Amber** — Already warm, just softened. `amber-600: #826d28` for trim button.

### Brand Colors

| Token         | Value     | Usage                                            |
| ------------- | --------- | ------------------------------------------------ |
| `brand`       | `#e5a00d` | Primary actions, active states, links, Plex gold |
| `brand-hover` | `#cc8e0b` | Hover state for brand buttons                    |
| `tmdb`        | `#4aaccc` | TMDB external links (desaturated from #01b4e4)   |

Use `bg-brand`, `text-brand`, `border-brand`, `ring-brand/50`, `hover:bg-brand-hover`, `focus:border-brand`, `text-tmdb`.

## Typography

**Font:** Manrope (Google Fonts, variable weight)

- Loaded via `next/font/google` in `layout.tsx`
- Applied as `--font-sans` override in `@theme`
- Geometric with rounded terminals — readable with personality
- Good weight range (200–800) for hierarchy

**Hierarchy pattern:**

- Headings: `text-xl font-bold` or `text-lg font-semibold`
- Body: `text-sm` (default weight)
- Labels: `text-xs tracking-wide uppercase text-gray-500`
- Data emphasis: `text-2xl font-bold`

## Depth Strategy

**Borders-only.** This is a tool, not a showcase.

- Standard borders: `border-gray-800` (whisper-quiet)
- Cards: `rounded-lg border border-gray-800 bg-gray-900`
- Header: `border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm`
- No drop shadows on cards
- No mixed depth strategies

## Spacing

Base unit: `4px` (Tailwind default `1` = 0.25rem).

- Component padding: `p-3` to `p-6`
- Section gaps: `space-y-6` to `space-y-8`
- Grid gaps: `gap-4`
- Page container: `mx-auto max-w-7xl px-4 py-8`

## Key Patterns

### Card (Media)

```
overflow-hidden rounded-lg border border-gray-800 bg-gray-900
```

Poster at `aspect-[2/3]`, badges overlaid top-left, content area `p-3 space-y-3`.

### Stat Card

```
rounded-lg border bg-gray-900 p-4
```

Clickable filter: active state uses `border-brand ring-1 ring-brand/50`.
Label: `text-xs tracking-wide uppercase text-gray-500`. Value: `text-2xl font-bold`.

### Primary Button (brand)

```
rounded-md bg-brand px-4 py-2 text-sm font-medium text-black hover:bg-brand-hover
```

### Secondary Button

```
rounded-md bg-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600
```

### Form Controls

```
rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200
focus:border-brand focus:outline-none
```

### Header

```
sticky top-0 z-10 border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm
```

Brand-colored admin link: `text-brand hover:underline`. Nav links: `text-gray-400 hover:text-gray-200`.

### Badge (Status)

Defined in `lib/constants.ts` as `STATUS_COLORS`, `VOTE_COLORS`. Pattern: `bg-{color}-900/50 text-{color}-300`.

### Selection

Brand-tinted: `rgba(229, 160, 13, 0.3)` via `::selection` in globals.css.

## Files

- `src/app/globals.css` — All theme tokens (@theme): gray scale, semantic colors, brand, font, selection
- `src/app/layout.tsx` — Font loading, base body classes
- `src/lib/constants.ts` — Status/vote color maps, sort labels
