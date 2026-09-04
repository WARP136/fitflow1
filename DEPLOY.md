# Deploying FitFlow

Netlify drag-and-drop, about three minutes. Commands are PowerShell.

There's no backend, so deploying just means handing someone the built `dist` folder
and letting them serve it over HTTPS.

## Build

```powershell
npm run verify
npm run assets
npm run build
```

`verify` and `assets` should both print `CLEAN`. Don't deploy over a failing verify.

Leave `.env` where it is; the Groq key gets compiled in, which is what makes Neha
answer for real on the live site and on your phone. Vite inlines anything prefixed
`VITE_` as literal text in the JavaScript, because a browser can't read `.env` at
runtime, so the key is readable by anyone who opens devtools on the deployed site.
For a prototype on a free tier that's a reasonable trade. Revoke it afterwards at
<https://console.groq.com> → API Keys.

Then check the real build before uploading it:

```powershell
npm run preview
```

That serves the built files at <http://localhost:4173> rather than the dev server,
so it catches anything that only breaks in production. Click every route and ask
Neha a question. `Ctrl+C` when you're happy.

## Netlify

Go to <https://app.netlify.com/drop> and drag the **`dist` folder itself** on — not
its contents, not the project folder. You get an HTTPS URL a few seconds later. Sign
in (GitHub is quickest) so the site doesn't expire, then Site configuration → Change
site name → something you can read out loud.

To redeploy: `npm run build` again, drag the new `dist` onto the site's Deploys tab.

## Check the live site

Refresh the page while on `/today`. A Netlify 404 there means `public/_redirects`
didn't make it into the build (see below). Then open `/scan` and allow the camera —
HTTPS is why that works at all, since browsers only hand over a camera on a secure
origin or localhost. Ask Neha something and confirm she answers live.

Make an account on the live site too. Accounts and data live in `localStorage`, which
is per-origin, so the one you use on localhost doesn't exist here and `/you` will be
empty. That's expected, but find it out now rather than on stage. For a populated demo
on the live URL, export from `/you` on localhost and import the file after signing in.

One thing quietly gets better on HTTPS: `crypto.subtle` exists on a secure origin, so
passwords are hashed with real PBKDF2 rather than the labelled fallback the sign-in
screen warns about on a plain-http LAN address.

## Open it on your phone before you present

A laptop webcam is fixed-focus, wide-angle and pointed at your face, which is close to
the worst possible barcode scanner. A phone has a rear camera with autofocus.

The deployed URL is HTTPS, so the phone grants camera access, and `barcode.js` asks for
`facingMode: 'environment'` whenever it detects a coarse pointer — so on a phone you
get the rear camera automatically. Same code, much better optics. If the scanner is
shaky on the laptop, present that part from your phone.

## Why `public/_redirects` exists

React Router handles every route inside the browser, and there's only ever one real
file, `index.html`. Type `/today` straight into the address bar and a normal static
host looks for a file called `today`, doesn't find one and serves a 404 — even though
the app works fine when you navigate there by clicking.

`public/_redirects` is one line:

```
/*  /index.html  200
```

Whatever path is asked for, serve `index.html` and call it a success, then let React
Router work out what to show. Vite copies `public/` into `dist` untouched, so it ships
automatically. If a deep-link refresh 404s, check `dist\_redirects` exists.

## If something goes wrong

**Build fails on a Tailwind class.** Someone upgraded Tailwind to 4, which ignores
`tailwind.config.js` where the palette lives. `npm i -D tailwindcss@3.4.17`.

**Build fails after a fresh clone.** Use `npm ci` rather than `npm install` — it
installs the exact versions in `package-lock.json`, which is why they're pinned.

**Neha works locally but not on the live site.** Vite only reads `.env` at build time,
so a key added after the build isn't in there. Rebuild and re-drop.

**Blank page, console says failed to load module.** Almost always a subpath problem.
This config assumes the site is at the root of its domain, which is what Netlify gives
you. Under a subfolder you'd need `base: '/subfolder/'` in `vite.config.js`.

**Camera won't start live but works on localhost.** Check the URL is `https://`, then
check the padlock menu for a blocked camera permission.

**No 3D background.** The CSS fallback is doing its job. Some machines refuse WebGL,
and nobody will notice.
