# FitFlow

**Team Solfinders** — Adrika Gaur, Shivansh, Siddartha Swain

A fitness app for people who have already quit three fitness apps. No streaks, no guilt, no
calorie homework. Fourteen screens, one companion (Neha), and nothing that ranks you.

Desktop-first React prototype. Everything is stored in your own browser; there is no server.

## Running it

Needs Node 18+ (we're on 20).

```bash
npm install
cp .env.example .env     # then paste your Groq key in
npm run dev
```

Vite serves it at http://localhost:5173. Use Chrome or Edge — Firefox's speech synthesis is
patchy and Safari won't speak without a user gesture first.

Don't run `npm update`. Three pins matter:

- Tailwind stays on **3.x**. v4 ignores `tailwind.config.js`, which is where the whole palette lives.
- `@react-three/fiber` stays on **8.x** (9 needs React 19, we're on 18.3.1).
- `@react-three/drei` stays on **9.x** to match fiber.

## The Groq key

It's the only key in the project. Food and barcodes come from Open Food Facts, movements from
wger, weather from Open-Meteo, the daily line from Quotable, jog tiles from OpenStreetMap,
and the voice is the browser's own `speechSynthesis`. All keyless. Barcodes are decoded on
your machine.

Get a free key at console.groq.com → API Keys. Put it in `.env`:

```
VITE_GROQ_API_KEY=gsk_...
```

The `VITE_` prefix is required — Vite won't expose anything else to browser code. Restart the
dev server after editing `.env`; it only reads the file at startup.

Skipping this is fine. Neha falls back to written replies, the pill in the chat header says
"No key - written replies", and nothing breaks.

There's also a `VITE_GROQ_MODEL` variable. Leave it unset. We used to hard-code
`llama-3.1-8b-instant` and the day Groq retired that id every reply quietly became a fallback.
Now the app asks Groq which models the key can use and picks a small fast one. The pill names
whichever model actually answered.

## Animations

Seven Lottie files live in `public/lottie/`, all already committed:

| File | Used by |
| --- | --- |
| `pushup.json`, `jumpingjacks.json`, `jumpingsquats.json` | the three movements and the timer |
| `water.json` | replays on every glass logged |
| `meditate.json` | the welcome hero, and blurred atmosphere on Today |
| `neha.json` | her portrait on Today, Neha and Your week |
| `jogging.json` | the Jog page before you press start |

Filenames must match exactly, lowercase, no spaces. `npm run assets` tells you what's present.

If you swap one out: the page is near-black, so light line-art in one bright colour works and
dark-stroked animations disappear. A missing file isn't fatal — `LottieBox` draws a pulsing
shape in the accent colour instead, because the JSON is fetched at runtime rather than imported.

## Scripts

```bash
npm run dev
npm run build       # into dist/
npm run preview     # serve dist/ at :4173
npm run assets      # which animations are present
npm run verify      # static + runtime checks, offline, ~2s
```

`verify` is worth knowing about. It parses every source file and checks the boring things that
break a React app on stage: imports resolve, every `dispatch({ type })` has a reducer case,
routes match nav entries, store keys exist, lucide icons exist, Tailwind classes map to real
tokens, no hooks outside functions. Four of its checks run real code — the EAN decoder against
synthetic barcodes, the camera pipeline against a fake `<video>`, the predictor against
hand-built logs, and the account store searched byte by byte for a stored password.

It has caught real mistakes. Two of them were in the predictor: combining two estimates by
taking the earliest low and the latest high turned a tight 12–21 week answer into 5–21 as soon
as a food diary appeared, and three collinear weigh-ins produced a standard error near zero and
a confident four-week promise. The slope error is floored at half a kilo now.

## Where things are

| Screen | Route | File |
| --- | --- | --- |
| Sign in | before the router | `src/pages/SignIn.jsx` |
| Welcome | `/` | `src/pages/Welcome.jsx` |
| Today | `/today` | `src/pages/Dashboard.jsx` |
| Move | `/move` | `src/pages/Workouts.jsx` |
| Water | `/water` | `src/pages/Hydration.jsx` |
| Food | `/food` | `src/pages/Nutrition.jsx` |
| Meal plan | `/plan` | `src/pages/DietPlan.jsx` |
| Scan a label | `/scan` | `src/pages/Scan.jsx` |
| Jog | `/jog` | `src/pages/JogTracker.jsx` |
| Neha | `/neha` | `src/pages/Chat.jsx` |
| Your sky | `/sky` | `src/pages/Sky.jsx` |
| This week | `/week` | `src/pages/WeeklyWrap.jsx` |
| Looking ahead | `/predict` | `src/pages/Predict.jsx` |
| You | `/you` | `src/pages/You.jsx` |

The parts that aren't screens:

**`src/data/energy.js`** — the file to read first. Three energy levels, each carrying an accent
colour, a motion tempo and a Lottie speed. That one choice drives the accent, every animation
duration, the marquee, the aurora's hue and rotation, the exercise playback rate and Neha's
speaking rate. Change a hex here and the whole product changes temperature.

**`src/store/AppState.jsx`** — one reducer, one object, mirrored into `localStorage` on every
change under `fitflow.v2::<account id>`. That's the entire persistence layer. `/you` prints the
saved object, names its key, exports it and imports one back.

**`src/services/accounts.js`** + **`src/store/Account.jsx`** — sign-in. A name, 16 bytes of
salt, and a PBKDF2-SHA256 digest at 120k iterations. The password is never written down. It
keeps two people sharing a laptop out of each other's logs and it is not a security boundary;
anyone with dev tools can read any account's data. `crypto.subtle` only exists on localhost and
https, so opening the dev server from a phone on the LAN falls back to a labelled scramble and
says so on screen.

**`src/services/predict.js`** — the predictor's arithmetic, pure, no React, no network. Fits a
least-squares line through your weigh-ins, takes the standard error of the slope, and separately
estimates a rate from the food log against a Mifflin–St Jeor maintenance figure at 7700 kcal/kg.
Returns a range of weeks and never a date. Refuses outright below a healthy BMI for your height.

**`src/services/ean.js`** — our own EAN-13/UPC-A/EAN-8 decoder, ~200 lines, no dependencies.
Chrome and Edge on Windows have no `BarcodeDetector` at all, so `barcode.js` falls back to this.

**`src/three/`** — the graphics. `Backdrop.jsx` is the aurora, mounted once in `Shell.jsx`.
`Scene.jsx` is the WebGL host and carries a capability check, an error boundary and a
reduced-motion path, so a bad GPU driver gets a CSS orb instead of a white screen.

`tailwind.config.js` has the palette and keyframes; `src/index.css` has the component classes
(`.card`, `.glass`, `.pill`, `.btn-primary`). You can restyle everything from those two files.

## When it breaks

**Blank white page.** F12, read the first red line. It's almost always one failed import and
the console names the file.

**Neha always answers offline.** In order: the file is `.env` and not `.env.txt` (Windows hides
extensions), the variable is spelled `VITE_GROQ_API_KEY`, and you restarted the dev server. If
all three are right, check the Network tab — 401 is a bad key, 429 is the free rate limit.

**An animation doesn't appear.** Open `http://localhost:5173/lottie/pushup.json` directly. If
you get the app's HTML back, the file isn't in `public/lottie/`.

**No voice.** Chrome won't speak until the tab has had a real click. Neha's voice is separate
and off by default — "Reading aloud" in the chat header. She never speaks the greeting or a
restored thread, on purpose.

**Wrong voice.** The Web Speech API has no gender field, so `voice.js` asks for an American
woman by name and works down a list: Aria, Jenny, Michelle, Zira, Google US English, then
Samantha and Ava on macOS. Whichever it lands on is printed in the chat.

**The camera won't start.** The page says why. Either the permission was blocked (padlock menu
in the address bar) or the page isn't on a secure origin — `getUserMedia` needs HTTPS, and
localhost counts but a LAN IP doesn't. Typed entry is right next to the camera; `3017620422003`
and `5449000000996` both resolve with no network.

**Camera is on but nothing reads.** The line under the video counts frames and shows the
resolution the camera agreed to. If it's climbing, the framing is the problem: a barcode is 95
bars wide and the decoder wants about three pixels per bar, so the bars need to fill roughly a
third of the width. That's closer than most people try. It reads upside down and sideways, and
it insists on the same number twice before accepting it. Glare is the usual last culprit.

**Barcode not in the database.** Open Food Facts is crowd-sourced and genuinely doesn't have
every product, especially Indian regional brands. Use one of the two demo codes.

**Grey map, no tiles.** No internet. Route, distance, pace and the coach all still work.

**Tailwind classes stopped working.** You upgraded to v4. `npm i -D tailwindcss@3.4.17`.

**Welcome screen came back.** The store version changed and the old save was discarded on
purpose. Click through once more.

**Port 5173 in use.** `npx kill-port 5173`, or take the port Vite offers.

## Offline

Everything above still works without wifi. Neha uses written replies, food search falls back to
a local pantry, the two demo barcodes resolve offline, the movement library drops to thirty
local exercises, and the jog map draws the route without tiles behind it.
