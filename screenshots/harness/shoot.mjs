/**
 * Full-page screenshots of the built site (out/) with canned API answers.
 *
 *   npx next build && node screenshots/harness/shoot.mjs [name-filter]
 *
 * Reuses the browser checks' mock backend and mock Drive (e2e/mocks.ts, run
 * by Node's own TypeScript support): the backend serves out/ with the real
 * headers and the review player's routes; every other /api answer here is
 * page.route() data below. Needs e2e/.media/clip.webm (made by
 * `npm run test:e2e`, or the ffmpeg line in e2e/global-setup.ts) and, under
 * WSL, LD_LIBRARY_PATH for Chromium (see the README). The hero needs the
 * internet for three.js, like the real site.
 */
import { chromium } from "@playwright/test";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startBackend, startDrive } from "../../e2e/mocks.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(ROOT, "out");
const SHOTS = path.resolve(HERE, "..");
const CLIP = path.join(ROOT, "e2e/.media/clip.webm");
const only = process.argv[2] ?? "";

const now = Math.floor(Date.now() / 1000);
const H = 3600;

// A tiny inline thumbnail: diagonal red/black bands with a title, so the
// tiles read as pictures without any network.
const thumb = (label, a = "#2a2626", b = "#e60012") =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${a}"/><polygon points="0,360 260,0 420,0 160,360" fill="${b}"/><polygon points="430,360 600,0 640,0 640,360" fill="#0b0b0b"/><text x="40" y="320" font-family="Arial Black,Arial" font-size="44" fill="#fff">${label}</text></svg>`,
  );

// ---------------------------------------------------------------- public
const PUBLIC = {
  "/api/public/live-status": { live: false },
  "/api/public/site-config": {
    social_links: {
      twitch: "https://twitch.tv/dualbladex",
      youtube: "https://youtube.com/@DualBladeX",
      instagram: "https://instagram.com/dualbladex7",
      discord: "https://discord.gg/example",
    },
  },
  "/api/public/videos": {
    videos: [
      { id: "a", title: "I let chat pick every gun for a whole ranked game", thumbnail: thumb("CHAT PICKS"), url: "https://youtube.com/watch?v=a" },
      { id: "b", title: "Operator only, Ascent, no regrets", thumbnail: thumb("OP ONLY", "#151313", "#8f000b"), url: "https://youtube.com/watch?v=b" },
      { id: "c", title: "The sheriff round that should not have worked", thumbnail: thumb("SHERIFF", "#3a3333"), url: "https://youtube.com/watch?v=c" },
    ],
  },
  "/api/public/clips": {
    clips: [
      { filename: "ace.webm", url: "/shots-media/clip.webm", title: "ace on bind" },
      { filename: "clutch.webm", url: "/shots-media/clip.webm", title: "1v4 clutch with a classic" },
      { filename: "sneeze.webm", url: "/shots-media/clip.webm", title: "the dragon sneezed mid round" },
    ],
  },
};

// ---------------------------------------------------------------- admin
const weapons = ["Vandal", "Phantom", "Operator", "Sheriff", "Spectre", "Judge", "Guardian", "Bulldog", "Marshal", "Stinger", "Odin", "Ares", "Outlaw"];
const STATUS = {
  streamerbot_connected: true,
  streamerbot_subscribed: true,
  streamerbot_authenticated: true,
  obs_websocket_connected: null,
  widget_connections: { total: 5, roulette: 2, badge: 1, spotify: 2 },
  ocr_agent: {
    connected: true,
    last_heartbeat_age_seconds: 6,
    last_capture_age_seconds: 41,
    last_accepted_age_seconds: 41,
    captures_received: 1840,
    captures_accepted: 1212,
    heartbeat_timeout_seconds: 45,
    tesseract_available: true,
  },
  public_url: { reachable: true, url: "https://hub.dualbladex.org", detail: "Reached this backend through the tunnel", checked_age_seconds: 12 },
  spotify: { configured: true, account_name: "dualbladex", account_product: "premium", requests_enabled: true, request_cost: 500, token_fresh: true, granted_scopes: [], missing_scopes: [] },
  credit_prediction: {
    predicted_credits: 4700,
    spendable_credits: 3500,
    reserved_credits: 1200,
    agent: "Jett",
    agent_kit_cost: 800,
    pistol_round: false,
    readings: [4700, 4700, 4700, 5100],
    last_reading: { credits: 4700, age_seconds: 41 },
    filter_enabled: true,
    votable_count: 9,
    total_weapons: 13,
    votable_weapons: ["Vandal", "Phantom", "Sheriff", "Spectre", "Judge", "Guardian", "Bulldog", "Marshal", "Stinger"],
    weapon_creds_costs: Object.fromEntries(weapons.map((w, i) => [w, [2900, 2900, 4700, 800, 1600, 1850, 2250, 2050, 950, 1100, 3200, 1600, 2400][i]])),
  },
  roulette: {
    active: null,
    last_result: {
      winner: "Judge",
      randomly_picked: false,
      final_weights: { Judge: 6, Vandal: 4, Odin: 3 },
      wheel_shares: { Judge: 7, Vandal: 5, Odin: 4 },
      predicted_credits: 4700,
      platform: "twitch",
      age_seconds: 74,
      winner_share_percent: 31,
      total_votes: 13,
    },
    forced_buy: { weapon: "Judge", phase: "queued" },
    on_cooldown: false,
  },
};

const SCHEMA = {
  sections: ["Streamer.bot", "Roulette", "Break screen", "Login & site"],
  fields: {
    streamerbot_ws_url: { label: "Streamer.bot address", description: "The gaming PC's WebSocket server, on the LAN address, never localhost.", section: "Streamer.bot", type: "text" },
    streamerbot_ws_password: { label: "Streamer.bot password", description: "Used to answer the server's challenge before subscribing.", section: "Streamer.bot", type: "secret" },
    roulette_chat_replies_enabled: { label: "Reply in chat", description: "Answer votes and errors in chat.", section: "Streamer.bot", type: "bool" },
    roulette_vote_seconds: { label: "Voting window", description: "How long chat can vote once a roulette opens.", section: "Roulette", type: "number", unit: "s", min: 5, max: 120 },
    roulette_affordability_filter_enabled: { label: "Only offer affordable guns", description: "Drop weapons the credit reading says you cannot buy.", section: "Roulette", type: "bool" },
    roulette_weapon_base_costs: { label: "Vote cost per weapon", description: "Channel points a vote costs.", section: "Roulette", type: "table" },
    break_default_minutes: { label: "Default break length", description: "What the Break tab starts with.", section: "Break screen", type: "number", unit: "min" },
    break_tips: { label: "Tips shown on the break screen", description: "One per line, rotated.", section: "Break screen", type: "list" },
    authorized_github_usernames: { label: "Streamer GitHub logins", description: "Who may open the dashboard.", section: "Login & site", type: "list", needed: true },
    public_base_url: { label: "Public address", description: "Checked every 30 s through the tunnel.", section: "Login & site", type: "text" },
  },
};
const CONFIG = {
  streamerbot_ws_url: "ws://192.168.1.40:8080/",
  streamerbot_ws_password: "••••••••",
  roulette_chat_replies_enabled: true,
  roulette_vote_seconds: 18,
  roulette_affordability_filter_enabled: true,
  roulette_weapon_base_costs: { Vandal: 300, Operator: 800, Sheriff: 150 },
  break_default_minutes: 5,
  break_tips: ["!song queues a track on my Spotify", "!rank shows where the session stands"],
  authorized_github_usernames: ["aryanverma7"],
  public_base_url: "https://hub.dualbladex.org",
};
const ADMIN = {
  "/api/status": STATUS,
  "/api/config": CONFIG,
  "/api/config/schema": SCHEMA,
  "/api/break": { active: true, duration_seconds: 600, remaining_seconds: 372, overdue: false, message: "Grabbing water, back soon", default_minutes: 5 },
  "/api/agents": { current: "Jett", agents: [{ name: "Jett", kit_cost: 800 }, { name: "Sova", kit_cost: 900 }, { name: "Omen", kit_cost: 850 }] },
  "/api/logs": { lines: [] },
};

// ---------------------------------------------------------------- editor
const VOD = { projectId: 1, tapeId: 10, iterationId: 102, fileId: "clipfile", filename: "main-cut-v3.webm", get size() { return statSync(CLIP).size; }, kind: "vod" };
const project = (id, name, extra = {}) => ({
  id, name, stream_date: "2026-10-28", stream_title: "", vod_filename: `${name.toLowerCase().replace(/\W+/g, "-")}.mkv`, vod_size: 41_800_000_000,
  vod_file_id: `vod-${id}`, vod_status: "ready", download_clicked_at: null, kind: "vod", duration_s: 14_820, reel_tape_id: null,
  tape_count: 2, has_new: false, created_at: now - 2 * 86400, ...extra,
});
const tape = (id, pid, name, status, extra = {}) => ({
  id, project_id: pid, name, kind: "tape", status, notes: "", files_deleted_at: null, source_project_ids: [], created_at: now - 86400, ...extra,
});
const checks = (res, fps, br) => ({ resolution: { state: res, value: "1920x1080" }, fps: { state: fps, value: 60 }, bitrate: { state: br, value: "14 Mbit/s" }, duration_s: 642 });
const iteration = (id, version, status, extra = {}) => ({
  id, tape_id: 10, version, filename: `main-cut-v${version}.webm`, size: 1_240_000_000, status, drive_file_id: `f${id}`,
  uploaded_at: now - (4 - version) * 6 * H, created_at: now - (4 - version) * 6 * H, checks: checks("pass", "pass", "pass"), has_thumbnail: false, ...extra,
});
const ITERATIONS = [
  iteration(100, 1, "ready", { checks: checks("pass", "pass", "warn") }),
  iteration(101, 2, "ready"),
  iteration(102, 3, "ready", { drive_file_id: VOD.fileId, size: VOD.size, filename: VOD.filename }),
  iteration(103, 4, "uploading", { checks: null, uploaded_at: null }),
];
const comment = (id, kind, author, body, start, extra = {}) => ({
  id, kind, author, body, start_s: start, end_s: start === null ? null : start + 2, created_at: now - 3 * H + id * 60, updated_at: now - 3 * H + id * 60,
  resolved: false, origin_iteration_id: 102, origin_version: 3, replies: [], ...extra,
});
const COMMENTS = [
  comment(1, "fix", "dualbladex", "Cut the dead air before the ace, it drags for a good four seconds.", 1.2, {
    replies: [{ id: 9, comment_id: 1, author: "editor1", body: "On it, trimming to the first shot.", created_at: now - 2 * H }],
  }),
  comment(2, "keep", "dualbladex", "The zoom on the sheriff headshot is perfect. Keep it exactly like this.", 3.4),
  comment(3, "question", "editor1", "Do you want the chat overlay visible during the clutch or hidden?", 4.8),
  comment(4, "fix", "dualbladex", "Music is louder than my voice here.", null, { resolved: true }),
];
const PROJECTS = [
  project(1, "Ranked grind to Ascendant", { has_new: true, tape_count: 2 }),
  project(2, "Chat picks every gun", { tape_count: 1, stream_date: "2026-10-25" }),
  project(3, "Operator only on Ascent", { tape_count: 0, stream_date: "2026-10-21", vod_status: "uploading" }),
];
const TAPES = [
  tape(10, 1, "Main cut", "in_review", { has_new: true, latest_version: 3, latest_iteration_id: 102, open_comments: 3 }),
  tape(11, 1, "Shorts: best moments", "cutting", { latest_version: 1, latest_iteration_id: 110, open_comments: 0 }),
];
const EDITOR = {
  "/me": { username: "dualbladex", role: "admin", brand_kit_url: "https://drive.google.com/drive/folders/example" },
  "/notifications": {
    unseen: 2,
    items: [
      { id: 31, at: now - 20 * 60, actor: "editor1", kind: "iteration_ready", summary: "editor1 uploaded Main cut v3", project_id: 1, tape_id: 10, iteration_id: 102 },
      { id: 30, at: now - 90 * 60, actor: "editor1", kind: "reply_added", summary: "editor1 replied on Main cut v3", project_id: 1, tape_id: 10, iteration_id: 102 },
      { id: 28, at: now - 26 * H, actor: "agent", kind: "vod_ready", summary: "Ranked grind to Ascendant is ready", project_id: 1, tape_id: null, iteration_id: null },
    ],
  },
  "/home": {
    vods_ready: [project(2, "Chat picks every gun", { stream_date: "2026-10-25" })],
    deletes_to_confirm: [project(4, "Bind retakes practice", { stream_date: "2026-10-12", download_clicked_at: now - 5 * 86400 })],
    open_tapes: [
      { tape: TAPES[0], project_name: "Ranked grind to Ascendant", latest_iteration_id: 102, latest_version: 3, open_comments: 3 },
      { tape: tape(21, 2, "Main cut", "changes_asked"), project_name: "Chat picks every gun", latest_iteration_id: 210, latest_version: 2, open_comments: 1 },
    ],
  },
  "/projects": { projects: PROJECTS },
  "/projects/1": { project: PROJECTS[0], tapes: TAPES },
  "/tapes/10": { tape: TAPES[0], iterations: ITERATIONS },
  "/iterations/102": { iteration: ITERATIONS[2], position_s: null, comments: COMMENTS },
  "/deletions": { pending: [] },
  "/drive/space": { limit: 2_199_023_255_552, free: 1_402_000_000_000 },
  "/fix-list": { items: [] },
  "/todos": { todos: [] },
};

async function main() {
  const drive = await startDrive({ [VOD.fileId]: CLIP });
  const backend = await startBackend(OUT, drive, [VOD]);
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

  async function page(width, height = 900) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: "no-preference" });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => console.log("  pageerror:", e.message));
    await p.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== backend.origin) return route.fallback();
      if (url.pathname === "/shots-media/clip.webm") return route.fulfill({ path: CLIP, contentType: "video/webm" });
      const table = { ...PUBLIC, ...ADMIN };
      if (url.pathname in table) return route.fulfill({ json: table[url.pathname] });
      const sub = url.pathname.replace(/^\/api\/editor/, "");
      if (url.pathname.startsWith("/api/editor") && route.request().method() === "GET" && sub in EDITOR) return route.fulfill({ json: EDITOR[sub] });
      return route.fallback();
    });
    return p;
  }
  // Let slams and wipes finish, so the picture is the resting state.
  const settle = (p, ms = 1200) => p.waitForTimeout(ms);
  // A fixed dialog covers the viewport only, so it is shot as the viewport.
  async function shot(p, name, fullPage = true) {
    if (!name.includes(only)) return;
    await settle(p);
    await p.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage });
    console.log("wrote", name);
  }

  try {
    for (const [w, suffix] of [[1440, "desktop"], [390, "phone"]]) {
      const p = await page(w, w > 500 ? 900 : 844);
      await p.goto(backend.origin + "/");
      await p.waitForFunction(() => document.querySelector("#world canvas"), null, { timeout: 30_000 }).catch(() => console.log("  no dragon canvas"));
      await settle(p, 2500);
      await shot(p, `home-${suffix}`);
      await p.context().close();
    }

    if ("admin".includes(only) || only.startsWith("admin")) {
      const p = await page(1440);
      await p.goto(backend.origin + "/admin");
      await p.getByText("System Status").waitFor();
      await shot(p, "admin-status");
      await p.getByRole("button", { name: /Config/ }).click();
      await p.getByRole("navigation", { name: "Settings sections" }).waitFor();
      await shot(p, "admin-settings");
      await p.getByRole("button", { name: /Break/ }).first().click();
      await p.getByText("Break screen").first().waitFor();
      await shot(p, "admin-break");
      await p.context().close();
    }

    for (const [w, suffix] of [[1440, "desktop"], [390, "phone"]]) {
      const p = await page(w, w > 500 ? 900 : 844);
      await p.goto(backend.origin + "/editor#/home");
      await p.getByRole("heading", { level: 2 }).first().waitFor();
      await shot(p, `editor-home-${suffix}`);
      if (suffix === "phone") {
        await p.context().close();
        continue;
      }
      await p.getByRole("button", { name: /Notifications/ }).click();
      await shot(p, "editor-bell");
      await p.getByRole("button", { name: /Notifications/ }).click();
      await p.goto(backend.origin + "/editor#/p/1");
      await p.getByText("Main cut").first().waitFor();
      await shot(p, "editor-project");
      await p.goto(backend.origin + "/editor#/p/1/t/10");
      await p.getByText("v4").first().waitFor().catch(() => {});
      await shot(p, "editor-tape");
      await p.getByRole("button", { name: "v4 menu" }).click();
      await p.getByRole("button", { name: "Cancel this upload" }).click();
      await p.getByRole("alertdialog").waitFor();
      await shot(p, "editor-dialog", false);
      await p.keyboard.press("Escape");
      await p.goto(backend.origin + "/editor#/p/1/t/10/v/102");
      await p.getByRole("heading", { name: "Version 3" }).waitFor();
      // Either it streams (Start watching now) or the small file is already down (Play).
      const start = p.getByRole("button", { name: "Start watching now" });
      const play = p.getByRole("button", { name: "Play", exact: true });
      await start.or(play).first().waitFor({ timeout: 20_000 });
      if (await start.isVisible()) await start.click({ timeout: 3000 }).catch(() => {});
      await play.first().click({ timeout: 20_000 }).catch(() => console.log("  no Play"));
      await p.waitForTimeout(1500);
      await p.evaluate(() => {
        const v = document.querySelector("video");
        if (v) {
          v.pause();
          v.currentTime = 3.4;
        }
      });
      await shot(p, "editor-review");
      await p.context().close();
    }
  } finally {
    await browser.close();
    await backend.close();
    await drive.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
