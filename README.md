# DualBladeX site

Next.js static export (`out/`), served by the Python backend in `stream-backend`.

```bash
npm run build      # static export -> out/
npx vitest run     # unit tests (jsdom)
npm run lint
```

## Browser checks (`e2e/`)

Playwright tests that run the built site in real Chromium and Firefox against a
mock backend (serves `out/` like `core/site_server.py` and answers the
`/api/editor` routes the review player uses) and a mock Drive (Range, Bearer
token, CORS). They cover service-worker playback and seeking, the OPFS
download, resuming a cut-off download, "Start watching now", and a clip under
one chunk. The test videos are made with `ffmpeg` on first run (`e2e/.media/`).

```bash
npx playwright install chromium firefox   # once
npm run test:e2e                          # builds, then runs both browsers
npx playwright test -c e2e --project=firefox -g "resumes"   # one test, one browser
```

On a Linux box without the browsers' system libraries (the WSL machine has no
sudo), extract the missing ones with `apt-get download libnss3 libnspr4` and
`dpkg -x <deb> <dir>`, then point the run at them:

```bash
LD_LIBRARY_PATH=<dir>/usr/lib/x86_64-linux-gnu npm run test:e2e
```

Firefox brings its own NSS and needs nothing extra.
