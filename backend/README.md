# AQENORA backend

The server behind the AQENORA seller app. It stores sellers, their shops and their products in a database, and handles seller login. It's built on [Medusa](https://docs.medusajs.com) 2.22, a free, open-source e-commerce engine. Medusa's ready-made admin dashboard is at `/app`.

This folder is a Medusa "DTC starter" workspace. The Medusa app itself is in `apps/backend/`. The Next.js storefront was not installed. AQENORA's storefront comes in a later step.

## What's in it so far

| Part | Where | What it does |
| --- | --- | --- |
| Seller module | `apps/backend/src/modules/seller/` | A seller's shop: name, web address (`handle`), category, country and currency, sells abroad, Paystack account (empty for now), store design, onboarding progress |
| Seller to product link | `apps/backend/src/links/seller-product.ts` | Each product belongs to one seller |
| Seller login | `medusa-config.ts` | Sellers are their own type of user, separate from admins and shoppers. They sign in with email and password |
| Workflows | `apps/backend/src/workflows/` | Create a seller, update a seller, add a product. Each step undoes itself if a later step fails |
| Seller API | `apps/backend/src/api/sellers/` | The routes the seller app will call (below) |
| Public store API | `apps/backend/src/api/store/sellers/[handle]/` | Shop details and products for a storefront page |
| Tests | `apps/backend/integration-tests/http/sellers.spec.ts` | 8 tests covering sign-up, duplicate addresses, login required, design updates, validation, products per seller, the country lock and the public store |
| Demo data | `apps/backend/src/scripts/seed-aqenora-demo.ts` | Creates "Adire House" (Nigeria) with 4 products, cost prices and 5 sample orders |

Currency follows the seller's country: NG to `ngn`, GH to `ghs`, ZA to `zar`, CI/SN to `xof`, abroad (DI) to `usd`. Once a seller has products, their country can't change, because the prices are in that currency.

## API

All `/sellers/me...` routes need a seller login token: `Authorization: Bearer <token>`.

| Method and path | Body | Returns |
| --- | --- | --- |
| `POST /auth/seller/emailpass/register` | `{ email, password }` | `{ token }` for a new login (Medusa built-in) |
| `POST /auth/seller/emailpass` | `{ email, password }` | `{ token }` to log in (Medusa built-in) |
| `POST /sellers` | `{ name, handle?, category?, country_code?, sells_abroad? }` | `{ seller }`. Creates the shop for a just-registered login; send the register token. Log in again afterwards to get a token that carries the seller id |
| `GET /sellers/me` | | `{ seller }` |
| `POST /sellers/me` | any of `name, handle, category, country_code, sells_abroad, theme, accent, font, announcement, onboarding_completed, design` (the full store design: see `src/modules/seller/design.ts`, strictly validated) | `{ seller }` |
| `GET /sellers/me/products` | | `{ products, count }`, newest first |
| `POST /sellers/me/products` | `{ title, price, stock?, cost_price?, description? }`, with price in whole units of the seller's currency | `{ product }` |
| `POST /sellers/me/products/:id` | any of `title, price, stock, cost_price` (`null` clears the cost) | `{ product }` |
| `GET /sellers/me/orders` | | `{ orders }`, newest first, with customer, items, total and status (`new`, `shipped`, `delivered`, `canceled`) |
| `POST /sellers/me/orders/:id` | `{ status: "shipped" \| "delivered" }`, one step at a time | `{ order }` |
| `GET /sellers/me/finance?period=7d\|30d\|all` | | sales, product costs, Paystack fees, AQENORA fee, profit, a daily (or monthly) series and profit by product |
| `GET /sellers/me/customers` | | past buyers with orders, total spent and email permission, plus group sizes |
| `GET /sellers/me/campaigns` | | sent emails |
| `POST /sellers/me/campaigns` | `{ audience: "all" \| "repeat" \| "lapsed", subject, message }`, where `{name}` becomes each buyer's first name | `{ campaign }`. At most `CAMPAIGNS_PER_DAY` (default 1) per shop per 24 hours |
| `GET/POST /marketing/unsubscribe/:token` | public | the unsubscribe page (GET shows a button; POST unsubscribes, also used by Gmail's one-click button) |
| `GET /admin/finance/sellers?period=` | admin login | every seller's numbers for the AQENORA team, totals per currency |
| `GET /store/sellers/:handle` | header `x-publishable-api-key` | `{ store, products }`, with no private fields |

Errors: 401 means not logged in. 400 means a bad value (for example an unknown theme) or a change that isn't allowed. 422 means the web address is already taken.

## Profit and email campaigns

**Profit.** Each order is linked to its seller, and each line keeps the price and the product's cost price at the moment of sale, so later changes don't rewrite past profit. Profit = sales − product costs − Paystack fee − AQENORA commission (`AQENORA_COMMISSION_PERCENT`, default 2). Paystack fees are **estimates** from Paystack's published rates per country (`src/lib/finance.ts`) until checkout records the real fee on each order (`metadata.payment_fee`). Cancelled orders don't count. Items sold before a product had a cost price use its current cost; if there is none, the seller sees a warning.

**Owner page.** In the admin dashboard (`/app`), "Seller finances" lists every seller's sales, costs, fees, AQENORA's earnings and the seller's profit (`src/admin/routes/seller-finance`).

**Email campaigns.**
- **Who gets them:** only buyers who said yes at checkout. The checkout tick box arrives with Paystack checkout; until then, sample orders set it.
- **Unsubscribing:** every email has its own unsubscribe link plus the List-Unsubscribe headers mail apps use for their built-in button. Unsubscribing is permanent until the buyer says yes again on a later order.
- **The seller's text:** shown as plain text, never as HTML.
- **Sending:** emails go out through Resend when `RESEND_API_KEY` is set, and are only written to the server log otherwise.
- **Code:** `src/modules/marketing`, `src/workflows/send-campaign.ts`, `src/modules/resend`.

**Orders so far** come from `createSellerOrderWorkflow` (used by the demo script and the tests). Paystack checkout will call the same workflow once a payment succeeds.

## Run it on your computer

You need [Node.js](https://nodejs.org/) 22.22 or newer and [PostgreSQL](https://www.postgresql.org/) 15 or newer. On a Mac, [Postgres.app](https://postgresapp.com) is the easiest way to get it. Redis is optional for development.

```bash
cd backend
npm install

cd apps/backend
cp .env.template .env
# In .env, set DATABASE_URL, e.g. postgres://postgres:postgres@localhost:5432/aqenora
# and make up long random values for JWT_SECRET and COOKIE_SECRET.
createdb aqenora                     # create the empty database

npx medusa db:migrate                # create the tables
npx medusa exec ./src/scripts/seed-aqenora-demo.ts   # optional demo store; also prints the publishable key for the store page
npx medusa user -e you@example.com -p choose-a-password   # optional: admin dashboard login
npm run dev                          # server at http://localhost:9000, admin at /app
```

Demo seller login: `demo@aqenora.com` / `aqenora-demo`. Change or delete it before going live.

**Run the tests** (needs Postgres running; they use their own throwaway database). There are 18 integration tests, plus unit tests for the fee maths (`npm run test:unit`):

```bash
cd apps/backend
DB_USERNAME=postgres DB_PASSWORD=postgres npm run test:integration:http
```

The tests and the seed script log "Search index product has no active version yet". That's expected: Medusa builds its product search index when the server starts, and they don't start it. It stops once `npm run dev` has run once.

## Settings (`apps/backend/.env`)

| Variable | What it's for |
| --- | --- |
| `DATABASE_URL` | Your Postgres database |
| `JWT_SECRET`, `COOKIE_SECRET` | Long random strings that sign logins. Required in production, and never commit them |
| `SELLER_CORS` | Web addresses allowed to call `/sellers` (the seller app): local dev and `https://5055corp.github.io` |
| `AUTH_CORS` | Web addresses allowed to call `/auth` (login). Includes the same ones |
| `STORE_CORS` | Web addresses allowed to call `/store` (the public store page): local dev and `https://5055corp.github.io` |
| `ADMIN_CORS` | Medusa default for the admin dashboard |
| `REDIS_URL` | Optional locally; recommended in production |
| `RESEND_API_KEY`, `EMAIL_FROM` | Sending campaign emails (resend.com). Empty = emails only logged |
| `CAMPAIGNS_PER_DAY` | Campaigns each shop may send per 24 hours (default 1) |
| `STORE_DOMAIN`, `STORE_PAGE_URL` | The shop link in emails: `https://<shop>.<STORE_DOMAIN>` once the domain works, else `STORE_PAGE_URL?shop=<shop>` |
| `MEDUSA_BACKEND_URL` | This server's public address (used in unsubscribe links) |
| `AQENORA_COMMISSION_PERCENT` | AQENORA's fee on each sale (default 2) |

## Not built yet

The seller app and the public store page (`app/`) are connected: set `VITE_API_URL` and `VITE_MEDUSA_PUBLISHABLE_KEY` (see `app/README.md`).

1. **Paystack.** Connect a seller's Paystack account (subaccount) and split each payment between seller and platform.
2. **Orders.** Buyer checkout, and orders showing up in the seller's dashboard.
3. **Stock.** Currently a number on each product (`metadata.stock`). It moves to Medusa's inventory system when orders arrive.
4. **Hosting.** For example Railway or Render for this server plus a managed Postgres database, and pointing `*.aqenora.com` at the store page so each store gets its own address.

For coding agents: see [`AGENTS.md`](./AGENTS.md) for commands, conventions and off-limits paths.
