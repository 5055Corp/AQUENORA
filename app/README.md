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
- `src/store.tsx`: app state, currency formatting, toast, responsive flags (React context)
- `src/settings.ts`: URL parameters
- `src/persist.ts`: saving and restoring the demo store (with validation of what's read back)
- `src/components/`: `Onboarding`, `Dashboard` (shell), `Home`, `Orders`, `Products`, `ThemeEditor`, `Help`

## Not wired up yet (prototype stand-ins)

- All data is demo data, saved only in this browser. There is no backend or auth.
- "Connect" for Paystack only flips a flag. The real OAuth/subaccount flow still needs to be built.
- Product photo areas are placeholders.
- "Copy link" uses the clipboard API. "Share on WhatsApp" opens `wa.me` with the store link.
