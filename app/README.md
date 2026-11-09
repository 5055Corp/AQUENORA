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
- **Theme editor** (Store design tab): sellers fully customise their store, with a live phone or computer preview:
  - **Starting styles:** 7 styles to start from.
  - **Colours:** any colour (picker or swatches) for background, text, buttons, button text and product cards. If something becomes hard to read, a warning appears with a one-tap fix (WCAG contrast).
  - **Fonts:** separate heading and body fonts, 10 Google Fonts, loaded only when used.
  - **Layout:** shop name left or centred, big/slim/no banner with the seller's own headline and subtext, 2/3/4 products per row, show or hide stock left, round/soft/square corners, pill/rounded/square buttons.
  - **Words and links:** announcement bar, About us, Instagram and WhatsApp links.

  The design is saved on the backend (`seller.design`) and drawn by `src/storefront/StoreView.tsx` for both the preview and the real store page. Stores that were set up before this keep their old look, converted automatically (`src/design.ts`).

## Financials and Customers pages

- **Financials:**
  - Sales, profit (with margin), product costs and fees for the last 7 days, 30 days or all time.
  - A sales vs profit line chart, with "Show as table" and a hover/tap readout.
  - "Where your sales went" and profit by product.
  - A warning when items were sold without a cost price.
  - Chart colours come from the dataviz skill's validated palette (colour-blind safe, 3:1 contrast).
- **Customers:** past buyers and whether each agreed to emails. Send an email to everyone, regulars (2+ orders) or lapsed buyers (no order in 60 days). `{name}` becomes each buyer's first name; there's a preview and a confirm step, and a list of sent emails.
- **Products:** an optional cost price when adding, plus "Add cost price"/"Change" on each product, showing what it makes per item.
- **Live mode:** Orders and Home show real orders, and status changes are saved. Numbers come from the backend (`/sellers/me/finance`, `/customers`, `/campaigns`).
- **Demo mode:** six weeks of sample sales and buyers (`src/demo.ts`), with the profit maths copied in `src/finance.ts`. Sending only pretends.

## Store page (what buyers see)

`store.html` is the public store page: the seller's chosen look, their products, and a bag. It's drawn by the same component as the theme editor's preview (`src/storefront/StoreView.tsx`), so the preview always matches the real page.

- **Which store:** `store.html?shop=<handle>`, e.g. `store.html?shop=adirehouse`. Once the domain and hosting are set up, `<handle>.aqenora.com` works too: the page reads the subdomain.
- **Opening it:** the seller dashboard's "View my store" button opens the seller's own page.
- **Products:** sold-out items show "Sold out". Buyers can't add more than the stock.
- **Bag:** kept in the buyer's browser, one per store. Checkout is switched off with a "coming soon" note until Paystack is built.
- **Demo mode:** shows the demo store from the seller app in the same browser, so during an interview the seller can see "their" store.
- **Live mode:** loads the store from the backend. It needs `VITE_MEDUSA_PUBLISHABLE_KEY` (see `.env.example`). A wrong address shows a "no store here" page.

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
- `src/state.ts`: the app state shape and starting values (shared with the store page)
- `src/finance.ts`, `src/demo.ts`: demo-mode profit maths and sample sales/buyers
- `src/storefront/`: the store page (`StorePage`, `StoreView`, `main.tsx` for `store.html`)
- `src/components/`: `Auth` (login, sign-up, loading), `Onboarding`, `Money`, `LineChart`, `Customers`, `Dashboard` (shell), `Home`, `Orders`, `Products`, `ThemeEditor`, `Help`

## Not wired up yet (prototype stand-ins)

- The backend isn't hosted yet, so live mode only works with the backend running on your computer.
- Orders and checkout: there are no real orders yet.
- "Connect" for Paystack only flips a flag. The real OAuth/subaccount flow still needs to be built.
- Product photo areas are placeholders.
- "Copy link" uses the clipboard API. "Share on WhatsApp" opens `wa.me` with the store link.
