# Love Letter Website

A private romantic website from Preet to Wifey: a love letter, chat memories, a heart game, a reply box, and **Do Pal** by ABRK through Spotify.

## Run locally

1. Install [Node.js](https://nodejs.org/) (v18 or newer).
2. Open a terminal in this folder.
3. `npm install`
4. `npm start`
5. Open `http://localhost:3000` in your browser.

On the first screen, click **Open your heart**, then press play in the Spotify player. The track is [Do Pal — ABRK](https://open.spotify.com/track/3Zr6QUmun7ewdGW4E1kBAd).

## Receive replies by email

The reply form saves the message and can email it to you through [Resend](https://resend.com).

1. Create a Resend account and an API key.
2. Verify a sending domain in Resend, or use `onboarding@resend.dev` for Resend's limited testing mode.
3. On your hosting provider, add these environment variables:

	- `RESEND_API_KEY`: your Resend API key
	- `NOTIFY_EMAIL`: the email address where you want to receive her messages
	- `FROM_EMAIL`: for example, `Love Letter <hello@yourdomain.com>` after verifying your domain

Never put the API key in `public`, HTML, or JavaScript files.

## Host it with your GoDaddy domain

Use a Node host such as Render or Railway. GoDaddy manages the domain; the host runs the Node server.

- [Render](https://render.com) — New Web Service, is folder ko connect karein, start command `npm start`.
- [Railway](https://railway.app) — same, `npm start`.
- [Fly.io](https://fly.io)

1. Create a new Web Service and connect this project repository.
2. Set the start command to `npm start`.
3. Add `RESEND_API_KEY`, `NOTIFY_EMAIL`, and `FROM_EMAIL` in the host's environment settings.
4. Deploy and open the temporary host URL to test the form.
5. In the host's custom-domain settings, add your domain, such as `yourdomain.com`.
6. In GoDaddy DNS, add exactly the records shown by your host. Usually this is a `CNAME` for `www` and an `A` record for the root domain.
7. Wait for DNS and HTTPS to finish activating, then test a real message.

Do not use only GoDaddy's static `public_html` hosting for this version. It can display the letter, photos, and Spotify player, but it cannot run the Node backend or send reply notifications.

## Features

- English interface with Roman Hindi reserved for the letter and poetry
- Official Spotify embed of Do Pal, plus its official YouTube video fallback
- Chat screenshots, shayari popup, 30-second heart game
- Simple backend: `GET /api/health`, `GET /api/notes`, `POST /api/notes`
