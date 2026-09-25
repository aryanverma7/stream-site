# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Viewers** of DualBladeX, a Valorant streamer on Twitch (`dualbladex`) and YouTube (`@DualBladeX`). They arrive from a stream, a video, Discord or a social link, often on a phone.
- **The streamer** (one person), using `/admin` from three places: a second monitor mid-stream (glance at status, set the break timer and agent, check the forced buy), a phone during stream, and the desk before stream (config, connecting accounts, testing points).

## Product Purpose

The public site's one job: get a visitor watching. Live, that means the Twitch embed and the merged Twitch + YouTube chat; offline, it means catching the next stream and watching YouTube videos meanwhile. Donate, clips and socials support that job.

The admin dashboard is the control room for the stream automation stack running on a Mac Mini: system health across two machines, the chat roulette and forced buy, the OCR credit reading, break screen, agent, points testing, logs, raw config.

## Positioning

The site is served by the streamer's own backend, so it shows things no link-in-bio page can: a live merged chat from both platforms, the backend's own clips, and a hidden admin door.

## Operating Context

- Next.js 16 static export served by the Python backend at hub.dualbladex.org via Cloudflare Tunnel. No Next server; every dynamic behaviour is a client fetch/WebSocket to the backend.
- `/admin` is gated by GitHub OAuth in the backend; the dashboard polls `/api/status` every 5s and is often behind OBS.
- The Mac Mini frequently runs a backend older than the built site; missing status fields must render as "not reporting", never break.

## Capabilities and Constraints

- Public: live status, Twitch embed, merged chat over `/ws/widgets?widget=chat`, offline YouTube recommendations, clips (video files from backend), Streamlabs donate link (outbound, never framed), social links from `/api/public/site-config`.
- Admin tabs: Status, Logs, Config (raw JSON + Streamlabs/Spotify connect), Points, Agent, Break.
- The 3D dragon hero stays, and so does its gesture: charging it to a max sneeze navigates to `/admin` with a real document navigation.
- Google Fonts only through a plain `<link>`, never `next/font/google`.
- Existing vitest suites assert on text and roles in these components.

## Brand Commitments

- Name: DualBladeX.
- The crowned potato king avatar is the mascot (photo-real renders in `../../Avatar/`, flat emote set in `../../emotes/dbx*_512.png`). The streamer's content voice is meme-comedy Valorant: thick-outlined yellow caption text, sticker cut-outs, reaction faces.
- Not binding: the Valorant teal/navy palette and Chakra Petch/Rajdhani (user did not keep them).

## Evidence on Hand

- Avatar renders and screenshots: `/home/aryan/projects/Avatar/`.
- 16 potato emotes at 512px: `/home/aryan/projects/emotes/`.
- No schedule data exists in the backend; do not invent stream times.
- No follower counts, sponsors or testimonials; do not fabricate any.

## Product Principles

1. Watching comes first; everything else is one scroll away.
2. The admin panel answers "is anything broken?" at a glance before it explains anything.
3. Honest states: unknown, not reporting, and down are different and look different.
4. The mascot carries the personality; the controls stay plain enough to use one-handed on a phone mid-stream.
