# Theme: Persona 5 style (`theme/persona5`)

A preview restyle of the whole site in the same world as the OBS widgets (`widgets/THEME.md`): red, black
and white comic panels, ransom-note cut-out lettering, slanted black slabs with a white stroke and a hard
red offset shadow, starbursts, speech bubbles and snappy motion. It is an original design in that style.
No Atlus logos, fonts, character art or assets: the type is Google Fonts and every shape is CSS or inline
SVG. Only the look changed: routes, behaviour, data flow and accessible names are the same as `main`.
`DESIGN.md` still describes `main`'s "Security Feed" look; replace it if this theme is adopted.

## The idea

Every surface is a page of a comic pasted together from cut-outs. Panels are black slabs drawn slightly
slanted, with a white stroke and a red shadow offset down and right. Panel names sit on cut strips (white
with black text, or red). The important words are stamped: Anton caps with a red offset, or ransom-note
letters cut from five papers. Things arrive by slamming in and overshooting a little, then they hold still.

- **Homepage**: the dragon now lives in a red room (fog, floor and ground bounce in
  `public/dragon-original.js` and `#world` in `Dragon.tsx` are all `#d80f1d`, and must stay equal). A black
  starburst turns slowly behind the title, a black slash carries it, and DUALBLADEX is cut out in ransom
  letters that slam in one by one. Sections below are black with a faint red halftone; the donate wall is
  the red field.
- **Admin**: red halftone header with the ransom mark; a black menu rail whose items skew and pop, the
  current one a white slanted slab. Status tiles are slabs with cut strips (white OK, amber Check, red Lost,
  grey Off/No report). The summary bar is a tilted red/amber band; "All feeds OK" and the roulette winner
  get a starburst.
- **Editor**: the same header and menu, slabs for cards and panels, the review player in a white frame with
  a red shadow, comments as speech bubbles, the "uploads ready" popup as a paper speech bubble, and the
  dialogs as slabs that slam in over a red-slashed halftone backdrop.

## Tokens (`app/globals.css`)

The token names are the old ones, so components kept their utility classes; only the values changed.

| Token | Value | Use |
|---|---|---|
| `--ink` | `#0b0b0b` | Page, slabs' text on red/white |
| `--bezel` / `--bezel-2` | `#151313` / `#221e1e` | Panel body / raised strip, hover |
| `--seam` | `#5c5555` | Hairlines and input borders inside panels |
| `--field` | `#ff1f30` | The red: fills with black text (5.1:1), red text on black (5.1:1) |
| `--field-hot` | `#ff5562` | Hover of anything red |
| `--field-deep` | `#e60012` | Offset shadows, starbursts (the widgets' `--red`) |
| `--blood` | `#8f000b` | Second red |
| `--phosphor` | `#ffffff` | Text, strokes |
| `--paper` | `#f4f1ea` | Cut-out paper |
| `--dim` | `#b9b4ab` | Quiet text (well over 4.5:1 on the panels) |
| `--rec` / `--signal` / `--amber` | `#ff3b3b` / `#9be86a` / `#ffc21a` | Lost or live / healthy / check |

Text on red is always black. White text on red is used only at display sizes.

Shape classes: `.slab` (slanted panel on a `::before`; needs a position; not for scroll containers, and it
is a stacking context, which is why `useAsk` portals its dialog to `<body>`), `.slab-sm`, `.slab-alert`,
`.slab-warn`, `.slab-ok`, `.slab-flat` (unslanted, for popovers and scrolling panels), `.strip-cut`,
`.tag`, `.bubble`, `.bubble-paper`, `.burst`, `.ransom` (via `<Ransom text>` in `components/Hero.tsx`),
`.wallpaper` (red halftone field; as a button it is the primary action), `.hazard`, `.tilt`.

## Type (one `<link>` in `app/layout.tsx`, never `next/font`)

- **Anton** (`.stencil`, `--font-stencil`): display caps with a red offset. Titles, headings, big numbers.
- **Archivo Black** (`.label`, `.tag`, `--font-tag`): controls, tags, status words.
- **Bebas Neue** (`.osd`, `--font-osd`): strip names, clocks, counters.
- **Archivo**: body text. **Martian Mono**: logs, config keys, the raw JSON editor.
- **Ransom letters** use all four plus paper colours; the paper per letter comes from its position and code,
  never at random, so the word renders the same every time. The letters are `aria-hidden`; an `sr-only`
  copy carries the word.

## Motion

- Slam in: `cubic-bezier(.2,1.4,.4,1)`, 300 to 380 ms. Headings, the summary band, dialogs, toasts, the
  break countdown.
- View change: the admin tab body and the editor view slam in while a red diagonal slash wipes across them
  (`.wipe`, 380 ms, a background moving inside the element's own box, `pointer-events: none`).
- Starburst pops (`.burst`, 380 ms) on: Settings "Saved.", an upload finishing, the roulette winner, "All
  feeds OK", the bell's unseen count, the uploads-ready popup.
- Menu items (`.menu-pop`) skew and scale on hover and keyboard focus, 150 ms; the current item stays
  skewed on a white slab.
- Loops are slow: the hero starburst turns once in 40 s; the live dot blinks at 0.8 Hz; the static
  texture changes 3 times a second. Nothing flashes faster than 3 times a second.
- Nothing waits on an animation: entries only, closing is instant, overlays never take pointer events.
- `prefers-reduced-motion: reduce`: every slam, wipe, pop, lean and loop is off; changes become a 150 ms
  fade.

## Focus

`:focus-visible` is a 3 px white keyline with a black gap and the red offset behind it, readable on black,
red and white. It overrides the old per-component outline utilities.

## Screenshots

`screenshots/*.png`, made by `screenshots/harness/shoot.mjs` against `out/` (run `npx next build` first;
under WSL set `LD_LIBRARY_PATH` as in the README). It reuses the browser checks' mock backend and mock Drive
from `e2e/mocks.ts` and answers every other `/api` call with canned data in the script.

- `home-desktop.png`, `home-phone.png`: the homepage, offline.
- `admin-status.png`, `admin-settings.png`, `admin-break.png`.
- `editor-home-desktop.png`, `editor-home-phone.png`, `editor-bell.png`, `editor-project.png`,
  `editor-tape.png` (versions), `editor-review.png` (review player with comments), `editor-dialog.png`.
