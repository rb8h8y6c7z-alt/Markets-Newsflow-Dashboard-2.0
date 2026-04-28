# Markets & Newsflow Dashboard

Deployable markets dashboard with major indices, large-cap stocks, macro instruments, movers, newsflow, and event radar.

## Repo Setup

For GitHub/Render, this folder should be its own repo. Upload the contents of `markets-news-dashboard` directly, so GitHub shows these files at the top level:

- `package.json`
- `server.js`
- `render.yaml`
- `public/index.html`
- `public/app.js`
- `public/styles.css`

Do not upload the parent Codex folder as the repo root, otherwise Render will not find `package.json`.

## Run Locally

Double-click `start.command`, or run:

```sh
node server.js
```

Then open:

```text
http://127.0.0.1:3050
```

## Deploy On Render

Create a new GitHub repo containing the contents of this `markets-news-dashboard` folder, then connect that repo to Render.

Render settings:

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Environment variable: `MARKETS_DASHBOARD_HOST=0.0.0.0`

The included `render.yaml` can also be used as a Render Blueprint.

## Sources

- Market prices: Stooq public quote CSV.
- Newsflow: FT, BBC Business, Investing.com RSS.

No API keys are required. Public market data can be delayed, incomplete, rate-limited, or unavailable.
