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

## Code layout

- `src/data.ts`: countries, fees, themes, demo orders and copy
- `src/store.tsx`: app state, currency formatting, toast, responsive flags (React context)
- `src/settings.ts`: URL parameters
- `src/components/`: `Onboarding`, `Dashboard` (shell), `Home`, `Orders`, `Products`, `ThemeEditor`, `Help`

## Not wired up yet (prototype stand-ins)

- All data is in-memory demo data. Nothing is saved, and there is no backend or auth.
- "Connect" for Paystack only flips a flag. The real OAuth/subaccount flow still needs to be built.
- Product photo areas are placeholders.
- "Copy link" uses the clipboard API. "Share on WhatsApp" opens `wa.me` with the store link.
