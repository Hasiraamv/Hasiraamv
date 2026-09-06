# Fit Pocket — Frontend

React + Vite + Tailwind CSS v4 + Framer Motion. Talks to the Fit Pocket
API at `https://api.fitpocket.in`. Deploys to `fitpocket.in` as a
Cloudflare Worker with static assets (Cloudflare's current recommendation
in place of Pages).

## Local dev

```bash
npm install
npm run dev   # http://localhost:5173, talks to the live API by default
```

To point at a local backend instead, set `VITE_API_BASE` (see
`src/lib/api.js`), e.g. `VITE_API_BASE=http://localhost:8787 npm run dev`.

## Deploy

```bash
npx wrangler login    # first time only
npm run deploy         # builds, then wrangler deploy
```

This deploys to the `fitpocket-web` Worker and routes `fitpocket.in/*` to
it (see `wrangler.jsonc`) — the `fitpocket.in` zone must already be active
in the Cloudflare account for the route to take effect. The backend
(`api.fitpocket.in`) is a separate Worker; see the repo root `README.md`.

`not_found_handling: "single-page-application"` in `wrangler.jsonc` makes
every unmatched path fall back to `index.html`, so client-side routing
(if added later) works correctly.
