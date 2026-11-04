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
| Demo data | `apps/backend/src/scripts/seed-aqenora-demo.ts` | Creates "Adire House" (Nigeria) with 4 products |

Currency follows the seller's country: NG to `ngn`, GH to `ghs`, ZA to `zar`, CI/SN to `xof`, abroad (DI) to `usd`. Once a seller has products, their country can't change, because the prices are in that currency.

## API

All `/sellers/me...` routes need a seller login token: `Authorization: Bearer <token>`.

| Method and path | Body | Returns |
| --- | --- | --- |
| `POST /auth/seller/emailpass/register` | `{ email, password }` | `{ token }` for a new login (Medusa built-in) |
| `POST /auth/seller/emailpass` | `{ email, password }` | `{ token }` to log in (Medusa built-in) |
| `POST /sellers` | `{ name, handle?, category?, country_code?, sells_abroad? }` | `{ seller }`. Creates the shop for a just-registered login; send the register token. Log in again afterwards to get a token that carries the seller id |
| `GET /sellers/me` | | `{ seller }` |
| `POST /sellers/me` | any of `name, handle, category, country_code, sells_abroad, theme, accent, font, announcement, onboarding_completed` | `{ seller }` |
| `GET /sellers/me/products` | | `{ products, count }`, newest first |
| `POST /sellers/me/products` | `{ title, price, stock?, description? }`, with price in whole units of the seller's currency | `{ product }` |
| `GET /store/sellers/:handle` | header `x-publishable-api-key` | `{ store, products }`, with no private fields |

Errors: 401 means not logged in. 400 means a bad value (for example an unknown theme) or a change that isn't allowed. 422 means the web address is already taken.

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

**Run the tests** (needs Postgres running; they use their own throwaway database):

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

## Not built yet

The seller app and the public store page (`app/`) are connected: set `VITE_API_URL` and `VITE_MEDUSA_PUBLISHABLE_KEY` (see `app/README.md`).

1. **Paystack.** Connect a seller's Paystack account (subaccount) and split each payment between seller and platform.
2. **Orders.** Buyer checkout, and orders showing up in the seller's dashboard.
3. **Stock.** Currently a number on each product (`metadata.stock`). It moves to Medusa's inventory system when orders arrive.
4. **Hosting.** For example Railway or Render for this server plus a managed Postgres database, and pointing `*.aqenora.com` at the store page so each store gets its own address.

For coding agents: see [`AGENTS.md`](./AGENTS.md) for commands, conventions and off-limits paths.
