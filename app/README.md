# AQENORA seller app

React + TypeScript + Vite implementation of `project/AQENORA Prototype.dc.html` (the Claude Design handoff).

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build into dist/
```

## Screens

- **Onboarding**: five steps (category, shop name, country/currency, first product, Paystack). On desktop a live store preview sits beside the steps.
- **Dashboard**: the "Get to your first sale" checklist, stats and a store-link card (Home); orders with filters and ship/deliver actions; products with an add form. Desktop gets a sidebar, phone gets a top bar and a bottom tab bar (switching at 760px).
- **Theme editor** (Store design tab): pick a style, main colour, lettering and announcement bar, with a phone or computer preview.

## Two modes: demo and live

| Mode | When | What happens |
| --- | --- | --- |
| **Demo** | `VITE_API_URL` is not set (this is how the GitHub Pages link is built) | Starts on the setup steps with sample data. Everything is saved only in this browser. Use it for seller interviews |
| **Live** | `VITE_API_URL` points at the backend | Sign up or log in, then the setup steps save a real store, products and store design to the backend |

To run live mode on your computer, start the backend first (see `backend/README.md`), then:

```sh
cp .env.example .env.local     # contains VITE_API_URL=http://localhost:9000
npm run dev
```

Demo seller login (after running the backend's seed script): `demo@aqenora.com` / `aqenora-demo`.

**How live mode works:**
- **Sign up:** creates a login. Setup then saves the store when you tap "Open my store dashboard" (or "Skip setup for now"), adds the first product and marks setup as done. If the web address is taken, you're sent back to the shop-name step with the reason.
- **Log in:** opens the dashboard with your store, or the setup steps if the store was never created.
- **Saved to the backend:** shop details, products (added from the dashboard) and the store design ("Publish changes").
- **Kept in this browser only, for now:** the Paystack "Connect" tick and the "shared" tick, because the backend doesn't store them yet. Orders are empty until checkout exists, and store visits show "—".
- **Staying logged in:** the login token is kept in the browser. An expired login sends you back to the login screen.

The demo-only URL parameters below (`screen`, `reset`) are ignored in live mode. `device` and `hints` work in both.

## Prototype "Tweaks" → URL parameters

| Param    | Values                                      | Default      |
|----------|---------------------------------------------|--------------|
| `screen` | `onboarding`, `dashboard`, `theme-editor`   | `onboarding` |
| `device` | `auto`, `mobile`, `desktop`                 | `auto`       |
| `hints`  | `on`, `off`                                 | `on`         |

Example: `/?screen=theme-editor&device=mobile`. With `device=mobile` on a wide window, the app is shown in a 420px phone frame.

## Demo mode: saved progress and Start over

The demo store is saved in the browser (`localStorage`), so a refresh keeps the shop name, products, orders and look. To clear it between seller interviews, tap **Start over** at the bottom of Home, or open the link with `?reset=1`. A `?screen=` parameter still picks the opening screen. If storage is blocked (for example in private browsing), the app works but doesn't save.

## Live demo link

`.github/workflows/pages.yml` builds the app and publishes it to GitHub Pages on every push to `main`:
**https://5055corp.github.io/AQUENORA/**. One-time setup: in the repository, go to Settings → Pages → Build and deployment and set Source to **GitHub Actions**.

## Code layout

- `src/data.ts`: countries, fees, themes, demo orders and copy
- `src/store.tsx`: app state, currency formatting, toast, responsive flags, and the live-mode actions (sign up, log in, finish setup, add product, publish design)
- `src/api.ts`: the backend client (`VITE_API_URL`), with error messages written for sellers
- `src/settings.ts`: URL parameters
- `src/persist.ts`: saving and restoring the demo store (with validation of what's read back), and the live login token
- `src/components/`: `Auth` (login, sign-up, loading), `Onboarding`, `Dashboard` (shell), `Home`, `Orders`, `Products`, `ThemeEditor`, `Help`

## Not wired up yet (prototype stand-ins)

- The backend isn't hosted yet, so live mode only works with the backend running on your computer.
- Orders and checkout: there are no real orders yet.
- "Connect" for Paystack only flips a flag. The real OAuth/subaccount flow still needs to be built.
- Product photo areas are placeholders.
- "Copy link" uses the clipboard API. "Share on WhatsApp" opens `wa.me` with the store link.
