---
name: DualBladeX
description: Security Feed. The stream is a camera feed; live is REC, offline is NO SIGNAL, the admin is the guard's monitor wall.
colors:
  ink: "#0a0c12"
  bezel: "#11141c"
  bezel-2: "#181c27"
  seam: "#2c3242"
  blue: "#6e95ff"
  field-hot: "#8eacff"
  deep blue: "#4a6fd9"
  dragon-room: "#7aa0ff"
  phosphor: "#eaeefa"
  dim: "#9aa3b8"
  rec: "#ff3b30"
  signal: "#8be36b"
  amber: "#ffa630"
typography:
  display:
    fontFamily: "Big Shoulders Stencil Display, Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "clamp(3.75rem, 13vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Big Shoulders Stencil Display, Big Shoulders Display, Arial Narrow, sans-serif"
    fontSize: "clamp(3rem, 9vw, 5.5rem)"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "0.02em"
  body:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    fontFeature: "\"tnum\" 1"
  label:
    fontFamily: "Archivo, Helvetica Neue, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    letterSpacing: "0.08em"
  osd:
    fontFamily: "VT323, Courier New, monospace"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.06em"
  mono:
    fontFamily: "Martian Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.625
rounded:
  none: "0px"
  dot: "9999px"
spacing:
  gutter-mobile: "16px"
  gutter: "24px"
  section: "64px"
  section-md: "96px"
  grid-gap: "20px"
  container: "72rem"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.field-hot}"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.blue}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "16px 28px"
  button-ink-hover:
    backgroundColor: "{colors.bezel-2}"
  button-outline:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.phosphor}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "10px 16px"
  button-outline-hover:
    textColor: "{colors.blue}"
  feed-strip:
    backgroundColor: "{colors.bezel-2}"
    textColor: "{colors.phosphor}"
    typography: "{typography.osd}"
    padding: "6px 12px"
  feed-strip-alert:
    backgroundColor: "{colors.rec}"
    textColor: "{colors.phosphor}"
  feed-strip-warn:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ink}"
  feed-body:
    backgroundColor: "{colors.bezel}"
    textColor: "{colors.phosphor}"
    rounded: "{rounded.none}"
  input:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.phosphor}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
  nav-tab-active:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.ink}"
    padding: "10px 12px"
---

# Design System: DualBladeX

## Overview

**Creative North Star: "Security Feed"**

Every surface is a monitor on a guard's wall. The public site is CAM 01 and CAM 02: the dragon plays behind scanlines with a burned-in clock, the Twitch player is a feed with a REC tag, and offline is a dead channel of static reading NO SIGNAL. The admin is the same wall seen from the guard's chair. Each subsystem is a feed tile that reads OK, Check, Lost, Off or No report before it explains anything. One world covers both, and `FeedFrame` is the shared object, so "a feed" means the same thing on both.

The palette is VCR blue on dead-monitor blue-black. The blue is a *field*, not an accent. It owns roughly a third of each screen as wallpaper bands, bezel strips, the donate wall and the active nav tab, and text sits on it in ink. Everything else is phosphor text on near-black bezels. The theme is single and dark by choice, because the site is watched at night and the admin sits beside OBS in a dim room. A light rendition would be a different world. The personality comes from the potato king emotes, die-cut as stickers and slapped on at an angle. The controls stay plain enough to use one-handed on a phone.

The world refuses the streamer-site default of dark rounded cards with platform purple.

**Key Characteristics:**
- One ink: VCR blue as a field, with ink text on it.
- Square corners everywhere. The only round shapes are status dots.
- State lives in form (signal bars, REC dot, static, dashed border) as well as in colour.
- Four typefaces with strict jobs: stencil display, Archivo UI, VT323 camera data, Martian Mono logs.
- CRT texture (scanlines, vignette, power-on, static) is part of the material, never a decoration on top of it.

## Colors

A two-tone world of VCR blue and blue-black, plus three signal colours that are reserved for state.

### Primary
- **VCR No-Signal Blue** (blue): the field colour. Wallpaper bands, feed strips on the blue tone, the donate wall, the active admin tab, primary buttons, stencil headings on ink, focus outline and text selection.
- **Hot Bright Signal Blue** (field-hot): hover state of anything blue. Never a resting colour.
- **Damask Deep blue** (deep blue): the faint stripe inside the wallpaper and the scrollbar thumb on hover. It is only a texture tone.
- **Dragon Room Blue** (dragon-room): the 3D hero's room background and fog. It is set in both `components/Dragon.tsx` (`#world` background) and `public/dragon-original.js` (fog and floor), and **the two must match**. It is deliberately a step brighter than the field blue, because scanlines and vignette darken the room. Nothing outside the dragon canvas uses it.

### Secondary (signal colours, state only)
- **REC Red** (rec): live and failure, nothing else. It covers the REC dot, the LIVE NOW plate, lost feed strips and borders, the lost summary bar, and error text.
- **Signal Green** (signal): healthy, nothing else. It is used only on up status badges with full signal bars.
- **Check Amber** (amber): "needs a look". It covers the warn feed strip, the warn summary bar and an overdue break clock. Ink text goes on amber, not phosphor.

### Neutral
- **Dead Monitor** (ink): page background, input wells, the ink button, and text on blue.
- **Bezel** (bezel): feed bodies, footer, admin nav rail, and the dim feed strip.
- **Bezel Raised** (bezel-2): default feed strip, the NO SIGNAL plate, and hover on dark nav items and the ink button.
- **Seam** (seam): 1px frame borders, scrollbar thumb, and the dashed no-report border.
- **Phosphor** (phosphor): body text on dark.
- **Dim Phosphor** (dim): secondary text, loading lines, off and unknown feeds, and inactive nav channel numbers.

### Named Rules
**The One Ink Rule.** Blue is spent as fields (bands, strips, plates, walls) with ink on top. Do not use it as a scatter of accent text across dark surfaces. Exceptions: stencil section headings and the text of the ink button.

**The Signal Reservation Rule.** Red means live or failed. Green means healthy. Amber means check. None of them decorates. When a feed is parked or silent, its red words drop to dim, because a quiet feed is not an alarm.

**The Night Room Rule.** There is one dark theme and no light mode. `color-scheme: dark` is set on the root.

## Typography

**Display Font:** Big Shoulders Stencil Display (with Big Shoulders Display, Arial Narrow)
**Body Font:** Archivo (with Helvetica Neue, Arial)
**Camera Data Font:** VT323 (with Courier New)
**Log/Config Font:** Martian Mono (with ui-monospace, Menlo)

**Character:** Hazmat stencil caps shout the few big words. Archivo does all the work a hand touches. VT323 is what the camera itself burns into the picture. The four roles do not overlap.

All four load through one plain `<link>` in `app/layout.tsx`. `next/font/google` is never used.

### Hierarchy
- **Display** (800, clamp(3.75rem, 13vw, 6rem), 0.88, +0.02em, caps): the DUALBLADEX mark in the hero and the donate wall's heading. **Six rem is the ceiling.**
- **Headline** (800, clamp(3rem, 9vw, 5.5rem), 0.88): section titles such as Live now, Offline and Clips, in blue on ink. Smaller fixed stencil sizes (text-5xl in the footer, text-4xl for Archive tapes, text-3xl in the admin header) follow the same face and settings.
- **Body** (400–500, 14–16px, tabular figures globally): descriptions, chat lines and feed body copy. Titles on cards are the same face at 700.
- **Label** (700, 11–14px, +0.08em, caps): every control and status word, including buttons, badges (Connected, Not reporting), tab names and chips laid over thumbnails.
- **OSD** (400, 18–48px, 1.0, +0.06em, caps): burned-in camera data only. That means feed names (CAM 02 · twitch.tv/…), timestamps and clocks, counters (T-01, CH1), and the strip state words (OK, Lost, NO SIGNAL).
- **Mono** (400, 11.5–12px, 1.625): the log viewer and the raw config editor, nothing else.

### Named Rules
**The Burned-In Rule.** VT323 is for what a camera would stamp on its own picture: names, times, counts, channel numbers. A word you can press, or a sentence you read, is Archivo.

**The Stencil Ceiling Rule.** Stencil is display caps at 6rem or less, with tracking kept positive, because the stencil bridges need air. It is never used for body text or for controls.

## Layout

Content sits in one centred column capped at 72rem, with 16px gutters on mobile and 24px from `sm`. Public sections stack vertically at 64px vertical padding (96px from `md`). The hero is the exception: it is full-viewport (`h-screen`), and its OSD is inset 24px (48px from `md`) inside viewfinder corner brackets. Card grids go one, two and then three columns at `sm` and `lg`, with a 20px gap. The live feed pairs the player and chat at 2.2fr to 1fr from `lg`.

The admin is a monitor wall. A blue header bar sits over a nav rail, which is a horizontal scroller on mobile and a 224px sticky left column from `lg`. The main area is the same 72rem column. Status feeds are whole-unit tiles in a grid, and the summary bar always comes before any tile.

Sections are divided by colour fields and 12px hazard bands, not by spacing alone.

## Elevation & Depth

Depth comes mostly from tone: ink, then bezel, then bezel-2, then the blue field. There are three soft ambient shadows, all dark, all long and low. They lift a monitor off the wall and a plate off the picture. There are no hard offset shadows, no coloured shadows and no glow.

### Shadow Vocabulary
- **Monitor lift** (`box-shadow: 0 12px 32px rgb(0 0 0 / 0.35)`): every `FeedFrame`.
- **Plate lift** (`box-shadow: 0 10px 24px rgb(10 12 18 / 0.3–0.35)`): the hero's live-state plate and the donate button, where each sits on blue.
- **Sticker cast** (`drop-shadow(0 10px 14px rgb(0 0 0 / 0.45))` under a 3px white keyline): die-cut stickers only.

### Named Rules
**The Glass Rule.** Screen texture sits on top of the picture and never takes input. Scanlines, vignette and static (`crt`, `noise`) are `pointer-events: none`, and so are the hero's brackets, OSD and stickers. The dragon under them is the admin door. An overlay that eats clicks locks the streamer out.

## Shapes

Everything is rectilinear, with 0px radius on frames, plates, buttons, inputs, tabs and cards. The only curves are the status dots (fully round, 8–12px). Frames are 1px seam borders. The -45° hazard stripe (14px blue, 14px ink) is the one diagonal in the system and marks the edges of a section. Stickers break the grid on purpose. Each sits rotated between -10° and +12° and bleeds off an edge.

**The Form-Carries-State Rule.** Every state has a shape as well as a colour:
- Healthy is four solid signal bars.
- Lost is zero bars, a red border and a blinking dot, over faint static.
- A dead channel is full static.
- No report is a dashed seam border.
- Live is the blinking REC dot.

The REC dot appears **only** while something is actually live or failing.

## Components

### Buttons
Buttons are square-cut and all in caps.
- **Shape:** square (0px).
- **Primary (wallpaper):** blue field with ink label text, 8×16px padding, extra-bold, tracked 0.08em. Hover goes to hot blue. Disabled drops to 40% opacity.
- **Ink:** ink field with blue text, carrying the plate-lift shadow. It is used where the button sits on blue (donate, hero). Hover raises it 2px and shifts it to bezel-2.
- **Outline:** a 1px seam border on ink with phosphor or dim label text. On hover, the border and text go blue. It covers secondary actions and closing things.
- **Focus:** a 2px solid blue outline at 3px offset, set globally.

### Feed Frame (signature)
This is the one monitor object. A VT323 strip names the feed on the left and carries its state on the right, over a bezel body with a seam border and the monitor-lift shadow. The strip has five tones:
- Dark (bezel-2), the default.
- Blue (wallpaper), used for chat.
- Alert (rec), for a lost feed.
- Warn (amber, admin tiles only).
- Dim (bezel), for off or dead feeds.

The body may carry `crt`. New surfaces that show a stream, a status or a picture use this frame and do not invent a card.

### Cards / Containers
- **Corner Style:** square.
- **Background:** bezel, over a picture area that has `crt` applied.
- **Border:** 1px seam, which turns blue on hover while the card lifts 4px (200ms ease-out).
- **Caption bar:** either phosphor text on bezel (clips) or a wallpaper caption with a VT323 tape counter (archive tapes).

### Status Badges
An Archivo label paired with signal bars. Up is signal green with four bars. Down is REC red with none. Unknown or not reporting is dim with none. An absent field reads "Not reporting" and never renders as blank or `undefined`.

### Inputs / Fields
- **Style:** ink well, 1px seam border, square corners, phosphor text. The config editor and log viewer use Martian Mono.
- **Focus:** the border turns blue, and the global blue outline applies.
- **Error:** REC red body text beneath the field.

### Navigation
The admin rail lists channels. Each tab has a VT323 channel number (CH1–CH6), an Archivo caps name, and a dim description at `lg`. The active tab is a blue field with ink text, and inactive tabs go bezel-2 on hover. The header is a wallpaper bar holding the stencil mark and the OSD clock. The public footer is a bezel slab with a stencil mark and outlined square social links that carry inline SVG icons.

### Stickers
Flat potato emotes (`public/stickers/*.png`) are cut out with a 3px white keyline and a soft cast shadow, rotated and bleeding off an edge. There is at most one per section. Each one reacts to state: king for OK or hero, shock for offline, love for donate, huh for empty or warn, scared for lost.

### Motion
- **Feed power-on** (`crt-on`, 700ms, cubic-bezier(0.16, 1, 0.3, 1)): a bright horizontal line opens to the full frame. It runs when a live grid, dead channel, modal or admin tab arrives.
- **REC blink:** 1.2s, stepped, never eased.
- **Static:** a 0.5s stepped shift of an SVG turbulence tile.

All three are disabled under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** spend blue as a field (wallpaper band, strip, plate, active tab) with ink text on it, and let it hold about a third of the screen.
- **Do** put a new status or picture inside the feed frame, naming the feed in VT323 on its strip.
- **Do** give every state a form (bars, dot, static, dashed border) as well as a colour, and render missing fields as "Not reporting".
- **Do** keep every overlay above the dragon at `pointer-events: none`, with the one real link opted back in.
- **Do** keep the dragon room colour identical in `Dragon.tsx` and `dragon-original.js`.
- **Do** name the static-noise utility `.noise`. Never name a custom utility `.static`: Tailwind v4 already owns `static` as the position utility, and the collision silently changes layout.

### Don't:
- **Don't** add a light theme or a platform-purple accent.
- **Don't** use REC red, signal green or amber for decoration, emphasis or brand. They are state only.
- **Don't** show a REC dot on anything that is not live or failing.
- **Don't** set buttons, sentences or controls in VT323, or set stencil above 6rem or at negative tracking.
- **Don't** round corners on frames, buttons, inputs or cards.
- **Don't** use hard offset shadows or glows. Depth is tone plus the three ambient shadows.
