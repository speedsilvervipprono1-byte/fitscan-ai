# FitScan AI — Gemini API key kept server-side

This bundle keeps the original FitScan AI interface and food diary, but routes Gemini calls through a serverless function. The browser no longer reads, stores, or sends a Gemini API key.

## Before deployment

1. Create a Gemini API key in Google AI Studio. Never paste it into `index.html` or commit it to Git.
2. Deploy this entire folder to **Vercel** or **Netlify** (not just `index.html`). Use Node.js 20 or newer.
3. In the hosting dashboard, add an environment variable named `GEMINI_API_KEY` with your key. Redeploy after saving it.
4. Keep usage monitoring/budget alerts enabled in Google AI Studio / Google Cloud. Free quota and model availability depend on Google's current terms and region.

## Vercel

- Import the project/repository in Vercel.
- Framework preset: Other; root directory is this project.
- Add `GEMINI_API_KEY` under Project Settings → Environment Variables (Production, and Preview if needed).
- Deploy. The API endpoint is `/api/gemini`.

## Netlify

- Import the project/repository in Netlify.
- Build command: leave empty; publish directory: `.` (the included `netlify.toml` configures this).
- Add `GEMINI_API_KEY` under Site configuration → Environment variables.
- Deploy. The included rewrite maps `/api/gemini` to the Netlify function.

## Important security and quota notes

- Do not run the new `index.html` by double-clicking it as `file://`; the `/api/gemini` endpoint only exists after deploying to Vercel/Netlify (or running a compatible local serverless environment).
- The function applies a small per-instance rate limit and image/request validation, but in-memory limits can reset or vary across serverless instances. For a public link, also configure platform-level rate limiting/WAF if available and monitor Google API usage. Otherwise strangers can consume your quota because this is a public endpoint.
- A free tier is not guaranteed, and quotas/model names can change. The default models are configured in `GEMINI_MODELS`; update this environment variable if Google changes availability.
- Existing users' old `fitscan_gemini_key` localStorage value is ignored by the new code. No personal key is needed in the browser.
- Keep `GEMINI_API_KEY` private. If a key was ever published in frontend code or Git history, revoke it and create a new one.
