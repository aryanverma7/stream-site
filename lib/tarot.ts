// The hero card's tarot: twenty original arcana, a dealer that never repeats one in a row, and the
// reading's clock (a flick shows an arcana for HOLD_MS, a new flick restarts it).

const I = "#0b0b0b";
const P = "#f4efe6";
const R = "#d80f1d";

export const HOLD_MS = 7000;

export function starPts(cx: number, cy: number, n: number, ro: number, ri: number, rot = -Math.PI / 2): string {
  return Array.from({ length: n * 2 }, (_, k) => {
    const r = k % 2 ? ri : ro;
    const a = rot + (k / (n * 2)) * Math.PI * 2;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");
}

export type Arcana = { n: string; name: string; fortune: string; art: string };

/** `art` is constant SVG markup for the middle of a 200x280 card. */
export const ARCANA: Arcana[] = [
  { n: "0", name: "THE FOOL", fortune: "Push the off-angle. Fortune favours the bold.",
    art: `<circle cx="140" cy="76" r="18" fill="${R}"/><path d="M26 212 L118 212 L130 152 L26 166Z" fill="${I}"/><circle cx="106" cy="104" r="9" fill="${I}"/><path d="M106 113 L104 142 M104 124 L86 116 M104 124 L126 112 M104 142 L92 160 M104 142 L122 150" stroke="${I}" stroke-width="6" stroke-linecap="round" fill="none"/>` },
  { n: "I", name: "THE MAGICIAN", fortune: "A clutch awaits you.",
    art: `<path d="M56 86 C56 62 96 62 100 86 C104 110 144 110 144 86 C144 62 104 62 100 86 C96 110 56 110 56 86Z" fill="none" stroke="${I}" stroke-width="10"/><path d="M92 128 L108 128 L104 212 L96 212Z" fill="${I}"/><polygon points="100,108 109,128 91,128" fill="${R}"/>` },
  { n: "VI", name: "THE LOVERS", fortune: "Your duo queue is blessed tonight.",
    art: `<path transform="translate(84 118) scale(2.3)" d="M0 22 L-22 0 A11 11 0 0 1 0 -14 A11 11 0 0 1 22 0 Z" fill="${R}"/><path transform="translate(118 140) scale(2.3)" d="M0 22 L-22 0 A11 11 0 0 1 0 -14 A11 11 0 0 1 22 0 Z" fill="none" stroke="${I}" stroke-width="3"/>` },
  { n: "VII", name: "THE CHARIOT", fortune: "Rush B. Do not stop.",
    art: `<polygon points="36,74 100,44 164,74 100,60" fill="${R}"/><circle cx="100" cy="136" r="50" fill="none" stroke="${I}" stroke-width="10"/>${Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4; return `<line x1="100" y1="136" x2="${(100 + Math.cos(a) * 48).toFixed(1)}" y2="${(136 + Math.sin(a) * 48).toFixed(1)}" stroke="${I}" stroke-width="6"/>`; }).join("")}<circle cx="100" cy="136" r="12" fill="${R}" stroke="${I}" stroke-width="4"/>` },
  { n: "XIII", name: "DEATH", fortune: "An ending, then a better round.",
    art: `<path d="M68 212 L134 58" stroke="${I}" stroke-width="9" stroke-linecap="round"/><path d="M134 58 C92 38 50 60 36 98 C66 78 100 72 130 76Z" fill="${I}"/><circle cx="150" cy="190" r="13" fill="${R}"/><path d="M150 203 L150 220" stroke="${I}" stroke-width="4"/>` },
  { n: "XVI", name: "THE TOWER", fortune: "After the chaos comes a full rebuy.",
    art: `<path d="M74 212 L80 92 L120 92 L126 212Z" fill="${I}"/><path d="M70 92 L130 92 L126 72 L74 72Z" fill="${R}"/><rect x="93" y="120" width="14" height="24" fill="${P}"/><polygon points="156,28 122,88 142,90 114,150 166,76 146,74" fill="${R}" stroke="${I}" stroke-width="3"/>` },
  { n: "XVII", name: "THE STAR", fortune: "Your aim is written in the stars.",
    art: `<polygon points="${starPts(100, 128, 8, 64, 22)}" fill="${I}"/><polygon points="${starPts(48, 62, 4, 16, 5)}" fill="${R}"/><polygon points="${starPts(156, 72, 4, 12, 4)}" fill="${R}"/><polygon points="${starPts(150, 198, 4, 14, 5)}" fill="${R}"/>` },
  { n: "XVIII", name: "THE MOON", fortune: "Trust the footsteps, not the sight.",
    art: `<circle cx="100" cy="122" r="56" fill="${I}"/><circle cx="126" cy="104" r="50" fill="${P}"/><path d="M60 196 q8 -16 16 0 a8 8 0 0 1 -16 0Z M96 210 q8 -16 16 0 a8 8 0 0 1 -16 0Z M132 194 q8 -16 16 0 a8 8 0 0 1 -16 0Z" fill="${R}"/>` },
  { n: "XIX", name: "THE SUN", fortune: "Win the eco, own the match.",
    art: `<polygon points="${starPts(100, 128, 12, 82, 50)}" fill="${I}"/><circle cx="100" cy="128" r="44" fill="${R}"/><circle cx="100" cy="128" r="16" fill="${P}" stroke="${I}" stroke-width="4"/>` },
  { n: "IX", name: "THE HERMIT", fortune: "Lurk. Patience wins the round.",
    art: `<path d="M100 44 L100 76" stroke="${I}" stroke-width="6"/><polygon points="${starPts(100, 126, 6, 50, 50, 0)}" fill="${I}"/><polygon points="${starPts(100, 126, 6, 28, 11)}" fill="${R}"/><rect x="84" y="172" width="32" height="12" fill="${I}"/>` },
  { n: "III", name: "THE EMPRESS", fortune: "Carry the team. They will thank you later.",
    art: `<polygon points="64,70 76,44 88,64 100,38 112,64 124,44 136,70" fill="${R}"/><circle cx="100" cy="122" r="36" fill="none" stroke="${I}" stroke-width="10"/><path d="M100 158 L100 212 M76 188 L124 188" stroke="${I}" stroke-width="10"/>` },
  { n: "IV", name: "THE EMPEROR", fortune: "Call the strats. They will listen.",
    art: `<rect x="56" y="100" width="88" height="110" fill="${I}"/><polygon points="68,92 68,62 84,76 100,52 116,76 132,62 132,92" fill="${R}"/><circle cx="100" cy="148" r="16" fill="${P}"/><path d="M100 132 L100 118" stroke="${P}" stroke-width="5"/>` },
  { n: "V", name: "THE HIEROPHANT", fortune: "Trust the default. It works for a reason.",
    art: `<path d="M100 46 L100 212 M78 78 L122 78 M68 102 L132 102 M58 126 L142 126" stroke="${I}" stroke-width="9"/><circle cx="100" cy="176" r="18" fill="${R}" stroke="${I}" stroke-width="5"/>` },
  { n: "VIII", name: "STRENGTH", fortune: "Hold the angle. Nerves of steel.",
    art: `<path d="M60 76 C60 58 92 58 100 76 C108 94 140 94 140 76 C140 58 108 58 100 76 C92 94 60 94 60 76Z" fill="none" stroke="${R}" stroke-width="9"/><path d="M62 122 L92 206 M92 116 L118 206 M122 120 L144 198" stroke="${I}" stroke-width="12" stroke-linecap="round"/>` },
  { n: "X", name: "WHEEL OF FORTUNE", fortune: "Your luck turns this round.",
    art: `${Array.from({ length: 8 }, (_, k) => { const a = (k * Math.PI) / 4, b = a + Math.PI / 4, p = (t: number) => `${(100 + Math.cos(t) * 58).toFixed(1)} ${(134 + Math.sin(t) * 58).toFixed(1)}`; return `<path d="M100 134 L${p(a)} A58 58 0 0 1 ${p(b)}Z" fill="${k % 2 ? R : I}"/>`; }).join("")}<circle cx="100" cy="134" r="14" fill="${P}" stroke="${I}" stroke-width="4"/><polygon points="86,54 114,54 100,82" fill="${I}" stroke="${P}" stroke-width="3"/>` },
  { n: "XI", name: "JUSTICE", fortune: "The trade is coming. Stay close.",
    art: `<path d="M100 52 L100 204 M50 76 L150 88 M70 208 L130 208" stroke="${I}" stroke-width="8"/><path d="M50 76 L32 132 M50 76 L68 132 M150 88 L132 144 M150 88 L168 144" stroke="${I}" stroke-width="3"/><path d="M28 132 A22 14 0 0 0 72 132Z M128 144 A22 14 0 0 0 172 144Z" fill="${R}"/>` },
  { n: "XII", name: "THE HANGED MAN", fortune: "Save your gun. Next round is yours.",
    art: `<path d="M36 52 L164 52" stroke="${I}" stroke-width="10"/><path d="M100 52 L100 72" stroke="${I}" stroke-width="4"/><circle cx="100" cy="170" r="28" fill="${R}"/><path d="M100 72 L100 150 M100 72 L124 98 L100 112 M100 124 L78 146 M100 124 L122 146" stroke="${I}" stroke-width="7" stroke-linecap="round" fill="none"/><circle cx="100" cy="166" r="12" fill="${I}"/>` },
  { n: "XIV", name: "TEMPERANCE", fortune: "Half buy. Patience pays.",
    art: `<path d="M42 72 L86 72 L80 118 L48 118Z M114 158 L158 158 L152 204 L120 204Z" fill="${I}"/><path d="M80 96 C112 102 124 126 136 156" stroke="${R}" stroke-width="9" fill="none"/>` },
  { n: "XV", name: "THE DEVIL", fortune: "One more game. Then one more.",
    art: `<path d="M64 118 C42 90 44 62 58 44 C62 70 74 92 90 104Z M136 118 C158 90 156 62 142 44 C138 70 126 92 110 104Z" fill="${R}"/><circle cx="100" cy="134" r="36" fill="${I}"/><polygon points="80,124 96,134 80,142" fill="${R}"/><polygon points="120,124 104,134 120,142" fill="${R}"/><circle cx="76" cy="198" r="14" fill="none" stroke="${I}" stroke-width="6"/><circle cx="100" cy="198" r="14" fill="none" stroke="${I}" stroke-width="6"/><circle cx="124" cy="198" r="14" fill="none" stroke="${I}" stroke-width="6"/>` },
  { n: "XX", name: "JUDGEMENT", fortune: "The replay will prove you right.",
    art: `<path d="M38 152 L128 104 L140 126 L50 170Z" fill="${I}"/><polygon points="128,104 166,72 176,160 140,126" fill="${R}"/><path d="M150 58 L160 40 M182 96 L192 88 M180 176 L192 186" stroke="${I}" stroke-width="6" stroke-linecap="round"/><rect x="34" y="192" width="44" height="20" fill="${I}"/><rect x="108" y="198" width="54" height="14" fill="${I}"/>` },
];

/** How often a real flick slices the card instead of drawing an arcana. */
export const SLICE_CHANCE = 0.2;

/** The idle slice: due a random 40-70 s after the latest poke, taken once per quiet stretch. */
export function createIdle(random: () => number = Math.random, min = 40_000, max = 70_000) {
  let at = Infinity;
  return {
    poke(now: number): number {
      return (at = now + min + random() * (max - min));
    },
    take(now: number): boolean {
      if (now < at) return false;
      at = Infinity;
      return true;
    },
  };
}

/** Endless draws from a shuffled deck, never the same item twice in a row (also across reshuffles). */
export function dealer<T>(items: T[], random: () => number = Math.random): () => T {
  let deck: T[] = [];
  let last: T | undefined;
  return () => {
    if (!deck.length) {
      deck = items.slice();
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      if (deck[0] === last) deck.push(deck.shift()!);
    }
    return (last = deck.shift()!);
  };
}

/** A reading against an injected clock: draw(now) shows a new card until `hold` ms after the latest draw. */
export function createReading<T>(next: () => T, hold = HOLD_MS) {
  let shown: T | null = null;
  let until = 0;
  return {
    draw(now: number): T {
      until = now + hold;
      return (shown = next());
    },
    /** When the latest draw stops showing. */
    until: () => until,
    current(now: number): T | null {
      if (now >= until) shown = null;
      return shown;
    },
  };
}
