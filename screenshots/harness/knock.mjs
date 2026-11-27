/**
 * Mid-knock hero screenshots (a tap on the calling card, shot ~90 ms in, while the blades flash).
 *
 *   npx next build && node screenshots/harness/knock.mjs
 *
 * Serves out/ statically (every /api answer is an empty 404), so it needs no mocks.
 */
import { chromium } from "@playwright/test";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../../out");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const server = http.createServer(async (req, res) => {
  const p = path.normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  for (const f of [p, p + ".html", path.join(p, "index.html")]) {
    try {
      const body = await readFile(path.join(OUT, f));
      res.writeHead(200, { "content-type": types[path.extname(f)] ?? "application/octet-stream" });
      return res.end(body);
    } catch {}
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end("{}");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
for (const [w, h, suffix] of [[1440, 900, "desktop"], [390, 844, "phone"]]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.goto(origin + "/");
  const card = p.getByRole("button", { name: "Calling card" });
  await card.waitFor();
  await p.waitForTimeout(1500);
  await card.click({ force: true }); // the idle turn never lets it be "stable"
  await p.waitForTimeout(60);
  const knocking = (await card.getAttribute("data-knock")) !== null;
  await p.screenshot({ path: path.resolve(HERE, `../hero-knock-${suffix}.png`), animations: "allow" });
  console.log(suffix, "knocking:", knocking);
  await p.close();
}
await browser.close();
server.close();
