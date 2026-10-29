# RISE — Wake up. Prove you're awake.

A mobile-first smart alarm clock (React + TypeScript + Vite + Tailwind). Alarms can require **math missions**, an **AI object scan** (TensorFlow.js COCO-SSD, runs fully on-device), or both before they stop.

## Run
```bash
npm install
npm run dev            # http://localhost:5173  (camera works on localhost)
HTTPS=1 npm run dev    # self-signed HTTPS so a phone on your Wi-Fi can use the camera
npm test               # unit tests (Vitest)
npm run build          # type-check + production build into dist/
npm run preview        # serve the production build
```
The COCO-SSD model (~18 MB) is shipped in `public/models/coco-ssd/` and served from your own origin — no external requests, no API keys.

## Deploy
`dist/` is a static site. Any HTTPS static host works (Vercel, Netlify, Cloudflare Pages, GitHub Pages): `npm run build`, publish `dist/`. HTTPS is required for the camera and for installing as a PWA.

## Test quickly
- **Settings → Test alarm now**: real ringing UI + missions in a temporary session (not counted in Insights, doesn't touch schedules).
- **Settings → Alarm in 1 minute**: a real one-time alarm that exercises the scheduler.
- **Editor → Object scan → Test scanner**: verifies the camera + detector without any alarm.

## Honest limitations
Web apps cannot ring when the page is closed, the phone is locked, or the OS suspends the browser. Alarms only fire while RISE is open. Use **Nightstand mode** (screen wake lock), keep the phone plugged in, and keep a normal phone alarm as backup. Missed alarms are recorded as "Missed", never as completed. Object detection can't prove a physical object (a photo on another screen may fool it).
# RISE
