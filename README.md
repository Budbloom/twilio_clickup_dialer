# Twilio + ClickUp Dialer

A lightweight Node + React application that generates Twilio Voice access tokens and provides a browser-based dialer page you can launch from ClickUp. When a ClickUp phone field link opens the dialer, the page reads the query parameter, requests a Voice SDK token from the backend, and places the call with Twilio.

---

## Prerequisites

- Node.js 18+
- Twilio Voice-capable project with:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_API_KEY` / `TWILIO_API_SECRET`
  - `TWILIO_TWIML_APP_SID`
  - `TWILIO_CALLER_ID` (Twilio number or verified caller ID presented on outbound calls)
- Netlify account (for hosting via Netlify Functions + static site)

---

## 1. Configure environment variables (local)

1. Duplicate `.env.example` as `.env` and insert your Twilio credentials:
   ```bash
   cp .env.example .env
   ```
2. Inside `frontend/`, copy `.env.example` to `.env.local` for the Vite dev server:
   ```bash
   cd frontend
   cp .env.example .env.local
   ```
3. Keep `.env` files out of version control.

The root `.env` powers the Express dev server *and* the Netlify Functions. The frontend `.env.local` sets `VITE_TOKEN_ENDPOINT=http://localhost:3001/token` so the React dev server reaches your local Express process.

---

## 2. Local development

Open two terminals from the project root:

```bash
# Terminal 1: backend token server
npm install
npm run dev
```

```bash
# Terminal 2: frontend
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173/?number=%2B14155551234`, allow microphone access, and press **Call**. Logs in the right-hand panel show Twilio Device status changes.

---

## 3. Netlify deployment

The repository now includes `netlify.toml` plus two serverless functions:

- `/.netlify/functions/token` issues Voice SDK tokens
- `/.netlify/functions/voice` returns `<Dial>` TwiML for Twilio callbacks

### 3.1 Build command and publish directory

Netlify reads `netlify.toml`, so you can deploy the repository root with:
- **Build command**: `npm run build`
- **Publish directory**: `frontend/dist`
- **Functions directory**: `netlify/functions`

The build script automatically installs `frontend/` dependencies and runs `vite build`.

### 3.2 Environment variables in Netlify

In your Netlify site settings add the same keys found in `.env`:

```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN       # optional, useful for REST API calls
TWILIO_API_KEY
TWILIO_API_SECRET
TWILIO_TWIML_APP_SID
TWILIO_CALLER_ID
ALLOWED_ORIGIN          # e.g. https://your-site.netlify.app
```

Add a frontend variable so Vite targets the serverless endpoint:

```
VITE_TOKEN_ENDPOINT=/api/token
```

(The redirect in `netlify.toml` maps `/api/token` → `/.netlify/functions/token`.)

### 3.3 Local Netlify emulation

With the Netlify CLI installed (`npm install -g netlify-cli`), run:

```bash
netlify dev
```

This proxies the Vite dev server and the functions so the React app can call `/.netlify/functions/...` without changing environment variables.

---

## 4. TwiML application wiring

1. Open Twilio Console → Programmable Voice → TwiML Apps → select the app with SID `TWILIO_TWIML_APP_SID`.
2. Set the **Voice Request URL** to your deployed endpoint, e.g.
   ```
   https://your-site.netlify.app/api/voice
   ```
   (Netlify redirects this to the `voice` function.)
3. Choose HTTP `POST`.
4. Ensure the TwiML app (or the phone number assigned to it) uses the same caller ID as `TWILIO_CALLER_ID`.

The `voice` function will read the `To` parameter sent from the browser and emit `<Dial>` TwiML so Twilio connects the outbound leg.

---

## 5. ClickUp link integration

Use a formula field or automation to compose the dialer URL, encoding the phone number:

```
CONCAT("https://your-site.netlify.app/?number=", URLENCODE({Phone Field}))
```

Rename the field to "Call" so teammates have a one-click dial link beside each phone number.

---

## 6. Troubleshooting

| Issue | Tips |
| --- | --- |
| Browser cannot fetch token | Verify `VITE_TOKEN_ENDPOINT` and Netlify environment variables; check CORS (`ALLOWED_ORIGIN`). |
| Call fails immediately | Confirm the TwiML App Voice URL points at `/api/voice` and Twilio logs show `<Dial>`. |
| No audio / microphone prompt | Serve the site over HTTPS (Netlify does this automatically) and test in Chrome with the console open for Twilio SDK logs. |
| Caller ID rejected | Use a Twilio number you own or verify the caller ID under Twilio Console → Verified Caller IDs. |

---

## 7. Next steps

- Populate `TWILIO_CALLER_ID` with a verified outbound number once you decide which identity to present.
- Test an outbound call in production-mode (Netlify preview/main) before rolling out ClickUp links widely.
- Consider enabling Twilio Client Voice debugger or adding error reporting (Sentry, LogRocket, etc.) if you expect heavy usage.
