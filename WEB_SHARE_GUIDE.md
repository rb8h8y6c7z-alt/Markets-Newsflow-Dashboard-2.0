# Web Share Guide

Use this when you want to email the dashboard link to someone else.

## 1. Create The GitHub Repo

Create a new GitHub repository, for example:

```text
markets-news-dashboard
```

Upload the contents of this folder directly into that repo. The repo home page should show `package.json`, `server.js`, `render.yaml`, and the `public` folder immediately.

If the repo shows a folder called `markets-news-dashboard` first, Render may fail because `package.json` is one folder too deep.

## 2. Create The Render Web Service

In Render:

1. Choose **New +**
2. Choose **Web Service**
3. Connect the GitHub repo
4. Use these settings:

```text
Runtime: Node
Build Command: npm install
Start Command: npm start
```

Add this environment variable:

```text
MARKETS_DASHBOARD_HOST=0.0.0.0
```

Render can also detect `render.yaml` and set most of this up as a Blueprint.

## 3. Share The Link

When Render says the service is live, open the Render URL. It will look something like:

```text
https://markets-news-dashboard.onrender.com
```

That is the link you can email to someone else.

## 4. Updating Later

When you want to update the shared version:

1. Upload the changed files to the same GitHub repo.
2. Render will normally redeploy automatically.
3. If it does not, open the service in Render and press **Manual Deploy**.

## Notes

No API keys are required. The app uses public quote and RSS sources, so data can be delayed, incomplete, rate-limited, or temporarily unavailable. On Render, the app will try Yahoo Finance chart data first for prices, then Stooq as a fallback.

On Render's free tier, the first visit after a quiet period can be slow because Render has to wake the service up. After that first wake-up, refreshes should normally be faster.
