# Demo notes

For whoever is presenting. Not a spec — the README has the technical detail.

## The pitch

> A fitness platform that meets people where they are, not where they think they should be.

Built for beginners and for the much bigger group who've already quit three fitness apps.
The hook to lead with: **there are no streaks in this app, anywhere.** That's the thesis, and
almost every other decision falls out of it.

## The run, about six minutes

Don't tour the sidebar. Four things properly beats fourteen things quickly.

**Landing screen.** Open on `/` and don't click. Say the pitch, then the streak line. Point out
the screen asks for nothing — no email, no questions about your body. One button.

**The energy row on `/today`.** This is the real demo. Set it to Steady, switch to Full-send,
then stop talking for two seconds and let them watch the page change. One choice moves the
accent colour, every animation duration, the aurora, the exercise playback rate and Neha's
speaking rate together. On a quieter day the product itself slows down. Don't rush this bit.

**`/move`.** Hover across the three tiles so the figures wake up one at a time. "No difficulty
levels, no beginner or advanced. Just movements." Start one, let the ring run a few seconds,
stop it.

**`/scan`.** Scan a real packet if the lighting is decent. If it hesitates for five seconds,
type the number and keep talking — the typed field is designed, not a failure. While the panel
loads: the browser's built-in barcode reader doesn't exist on Windows, so we wrote our own,
no dependencies, nothing added to the bundle. Then the design point: there's no letter grade
here and nothing in red. Open Food Facts gives us a Nutri-Score and we throw it away. Numbers
inform, grades judge.

**`/neha`.** Ask what a beginner would actually ask — "I haven't worked out in two weeks, where
do I start?" Turn on Reading aloud. Point at the context panel: that's everything she can see.
Flip her tone and ask again.

**Close on `/sky`, then ten seconds of `/you`.** Every star is calculated from the logs rather
than stored, so the sky can never disagree with your data. No total, no rank, nothing to
compare — a reward you can lose is a punishment on a timer. Then `/you`: here's every byte we
keep, under the key it's kept at, and a button to export it.

Hold back `/predict`, `/plan`, `/jog` and `/week` unless asked. Saying you have more is
stronger than showing all of it.

## Questions we've been asked

**Why no streaks?** A streak is a threat. Break one and the app becomes a record of your
failure, which is exactly when people delete it. We're designing for the day after the bad day.

**Then what's the motivation?** The sky only ever grows, and it has no total and no rank.

**How is this different from Strava?** Strava isn't badly built, it's built for someone who
already trains. Different user, so most decisions invert.

**Doesn't the predictor contradict all that?** Best question, and we asked it ourselves. A
single date is a deadline, and a deadline is the streak problem in a different hat. So
`/predict` gives a range of weeks and never a date, shows both estimates it drew the range
from, and leaves the far end open when the evidence is thin. Forecast, not a due date.

**What if the target is unhealthy?** It refuses. Below BMI 18.5 for your height it calculates
nothing, names the healthy floor and points at a doctor or dietitian. That refusal is covered
by `npm run verify`.

**Is the prediction AI?** No, and that's the point — it's arithmetic in `predict.js` you can
read. Least-squares line through the weigh-ins with the standard error of the slope as the
range width, floored at half a kilo because no bathroom scale is better than that. Separately,
energy balance from the food log against a Mifflin–St Jeor maintenance figure at 7700 kcal/kg,
±20% because food diaries undercount. Where both exist the weigh-ins win.

**Doesn't logged exercise get counted twice?** It would if we added it on top, so logged
minutes replace the activity multiplier instead. The page says which basis it used.

**Is the login safe?** It isn't a security boundary and the screen says so. Anyone with dev
tools can read any account out of localStorage. What we did do properly: 16 bytes of salt per
account and PBKDF2-SHA256 at 120k iterations, so the password itself is never stored. `verify`
creates real accounts and greps every stored byte for it.

**Is that a video in the background?** No, WebGL, live on the GPU, with a CSS fallback and an
automatic stop if the OS asks for reduced motion.

**Is the jog GPS real?** No, and the UI says so. Laptops have no GPS chip, so browser location
resolves from wifi and jumps around. We'd rather show the interaction than fake a sensor.

**Is Neha really an LLM?** Yes, Groq. She also has written fallbacks, and the pill in the
header says which one answered. If the wifi dies, point at the pill.

**Is the weather your location?** No, fixed to Delhi. We didn't want a permission prompt in
the middle of a demo.

**Did you make the animations?** The Lottie files are from LottieFiles under their free
licence. The motion system around them is ours.

**How much of this is AI-generated?** Answer honestly and briefly, then show you understand
it — explain the energy system or the barcode resolution problem in your own words.

**What broke and how did you fix it?** Favourite question, have it ready. The scanner looked
like it worked and didn't: the camera defaulted to 640×480, which is too coarse to resolve a
barcode's thinnest bar at any normal distance, and our tests passed the whole time because
they tested the decoder one layer inside the actual bug. Fix was asking for 1920, reading the
frame at full size, and a new test that builds whole camera frames instead of clean scanlines.

**How do you test it?** `npm run verify`, offline, about two seconds. Imports, dispatched
actions against reducer cases, routes against nav links, icons, Tailwind classes, hook
placement — and four checks that run real code rather than reading it.

## If something breaks on stage

Narrate what you're doing. Calm narration reads as competence.

**Camera won't start.** The page says why in one sentence: blocked permission (padlock menu) or
a non-secure origin (localhost fine, LAN IP not). Type the barcode and keep talking.

**Camera on, nothing reading.** Check the counter under the video. Climbing means it's looking,
so bring the packet much closer — about a third of the frame width — and tilt it off the lamp.
Then just type `3017620422003`.

**Neha answers offline.** That's the fallback working. Say so out loud.

**No 3D background.** The CSS fallback is already covering it. Don't mention it.

**Nothing loads.** `npm run dev` again, check the port. If the palette looks wrong, somebody
upgraded Tailwind to 4.

**Last resort:** run `npm run verify` and leave it on screen while you talk.
