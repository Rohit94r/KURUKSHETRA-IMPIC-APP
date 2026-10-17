# Hosting Layerflow on Render (free plan)

One Render web service runs everything: the website, the API and the Python
sandbox. The Android app and the website both use its URL.

## 1. Create the service

**With the Blueprint** (reads [`render.yaml`](../render.yaml)):

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
2. Pick the repo — connect GitHub, or paste the public URL
   `https://github.com/Rohit94r/KURUKSHETRA-IMPIC-APP`.
3. Render shows one web service, **layerflow** (Free, Singapore). It asks for the
   optional keys — paste the ones you have from your local `.env`, leave the rest blank:
   `GROQ_API_KEY`, `GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `RAZORPAY_KEY_ID`,
   `RAZORPAY_KEY_SECRET`, `GITHUB_TOKEN`.
4. **Apply**. The first build takes about 5–10 minutes (install, build the site,
   seed the demo learners).

**Without the Blueprint** — **New** → **Web Service** → the repo, then:

| Setting | Value |
|---|---|
| Language | Node |
| Branch | `main` |
| Region | Singapore |
| Build command | `npm ci --include=dev && npm run build && npm run seed` |
| Start command | `npm start` |
| Instance type | Free |
| Health check path | `/api/health` (Advanced) |

Environment variables: `NODE_VERSION=24`, `NODE_ENV=production`,
`NEXT_TELEMETRY_DISABLED=1`, `LAYERFLOW_API_HOST=127.0.0.1`, `LAYERFLOW_WARM=1`,
`LAYERFLOW_MAX_RUNNERS=1`, `LAYERFLOW_MEM_MB=64`, `LAYERFLOW_LIMITS=off`,
`LAYERFLOW_CHECKOUT=demo`, `LAYERFLOW_TZ_OFFSET_MIN=330`, a long random
`LAYERFLOW_ADMIN_TOKEN`, plus whichever keys you have.

## 2. Check it

Open `https://<your-service>.onrender.com/api/health` — you should see
`{"ok":true, …}`. The website is at the root URL, the judges' page at `/judges`.

## 3. Point the Android app at it

- In the app: **Me → Server** → `https://<your-service>.onrender.com` → **Test** → **Save**.
- Or make it the app's default: `npm run app:build -- --server https://<your-service>.onrender.com`,
  then **Run ▶** in Android Studio.

## What the free plan means

- **It sleeps** after 15 minutes without visitors. The next visit wakes it, which takes
  about a minute — the app says "Waking the server up…" meanwhile.
- **No disk**: the demo learners are seeded during the build and every restart or
  deploy starts again from that demo state. Progress made in between is not kept.
- **512 MB RAM**: the sandbox runs one Python process at a time (`LAYERFLOW_WARM=1`,
  `LAYERFLOW_MAX_RUNNERS=1`, `LAYERFLOW_MEM_MB=64`). Measured locally with these
  settings: ~360 MB in use, under 470 MB at the busiest. Submissions queue rather than
  run side by side, so a burst of users waits a little.
- **/admin** is protected by `LAYERFLOW_ADMIN_TOKEN` — the Blueprint generates one;
  find it under the service's **Environment** tab.
- **Deploys**: with GitHub connected, every push to `main` redeploys. With a pasted
  public URL, use **Manual Deploy → Deploy latest commit**.

## Outgrowing free

On **Standard** (2 GB): add a disk (mount path `/var/data`), set
`LAYERFLOW_DB=/var/data/layerflow.db`, drop `npm run seed` from the build command,
and raise `LAYERFLOW_WARM=3`, `LAYERFLOW_MAX_RUNNERS=6`, `LAYERFLOW_MEM_MB=320` —
progress is then kept and several submissions run at once.
