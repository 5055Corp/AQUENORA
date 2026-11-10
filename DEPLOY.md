# Putting AQENORA online (Railway)

This guide takes AQENORA from GitHub to a live website. You do the account and settings steps; everything technical is already set up in the code (`backend/Dockerfile`, `app/Dockerfile`, `railway.json` files).

**What you'll have at the end**

| Address | What it is | Railway service |
| --- | --- | --- |
| `api.aqenora.com` | The backend (data, logins, payments) and your admin dashboard at `/app` | `backend` |
| `app.aqenora.com` | The seller app | `web` |
| `<shop>.aqenora.com` | Each seller's store | `web` |
| `stores.aqenora.com` | The address sellers point their own domains at | `web` |

You can start without the domain (Railway gives free `*.up.railway.app` addresses) and add `aqenora.com` later in Part 4.

**Costs to expect:** Railway about $5–20 a month to start (backend, web, database and Redis), the domain about $10–15 a year, and email (Resend) free for the first 3,000 emails a month.

---

## Part 1: Accounts

1. **Railway:** sign up at [railway.com](https://railway.com) with your GitHub account and add a payment card. The free trial isn't enough to keep a store running.
2. **GitHub access:** when Railway asks, let it see the `5055Corp/AQUENORA` repository.
3. **Optional now, needed for launch:**
   - [Resend](https://resend.com), for campaign emails.
   - A Paystack account, for payments.

## Part 2: The backend

1. In Railway, click **New Project → Deploy from GitHub repo** and choose `5055Corp/AQUENORA`.
2. Open the new service, go to **Settings**, set **Root Directory** to `backend`, and rename the service to `backend`. Railway finds `backend/railway.json` and builds with the Dockerfile.
3. In the same project, click **New → Database → PostgreSQL**, then **New → Database → Redis**.
4. Open the `backend` service → **Variables** and add these. The `${{ }}` parts are Railway references, so copy them exactly:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `REDIS_URL` | `${{Redis.REDIS_URL}}` |
   | `JWT_SECRET` | a long random string (see the note below) |
   | `COOKIE_SECRET` | a different long random string |
   | `MEDUSA_BACKEND_URL` | the backend's public address, from step 5 (e.g. `https://backend-production-1234.up.railway.app`) |
   | `ADMIN_CORS` | the same address as `MEDUSA_BACKEND_URL` |
   | `STORE_CORS`, `AUTH_CORS`, `SELLER_CORS` | the web service's address, from Part 3 (you'll come back to these) |
   | `BILLING_CONTACT` | your WhatsApp number for Pro payments by transfer, e.g. `+234 801 234 5678` |
   | `STORE_PAGE_URL` | the web service's address + `/store.html` (from Part 3) |

   **Random strings:** use a password manager's generator, at least 40 characters, letters and numbers. Never share them or put them in GitHub.

5. Go to **Settings → Networking → Generate Domain**. Copy that address into `MEDUSA_BACKEND_URL` and `ADMIN_CORS`.
6. **Deploy.** On every start the backend applies database changes by itself, but only safe ones; nothing is ever deleted automatically. Check that `https://<backend address>/health` shows `OK`.
7. **Create your admin login.**
   1. Install the [Railway CLI](https://docs.railway.com/guides/cli) on your computer.
   2. Run `railway login`, then `railway link` (pick the project).
   3. Run `railway ssh --service backend` and, inside it:

      ```sh
      npx medusa user -e you@yourcompany.com -p "a-strong-password"
      ```

   4. Log in at `https://<backend address>/app`.
8. **Get the publishable key:** in the admin dashboard, go to **Settings → Publishable API Keys** and copy the key that starts with `pk_`. Part 3 needs it.
9. **Set your plan prices:** in the admin dashboard, open **Plans & pricing**. Check the Pro price for each country, the commission and the trial length.

## Part 3: The web app (seller app + store pages)

1. In the same project, click **New → GitHub Repo → `5055Corp/AQUENORA`** again. Set **Root Directory** to `app` and rename the service to `web`.
2. **Variables:**

   | Variable | Value |
   | --- | --- |
   | `VITE_API_URL` | the backend address from Part 2, step 5 |
   | `VITE_MEDUSA_PUBLISHABLE_KEY` | the `pk_...` key from Part 2, step 8 |
   | `VITE_STORE_DOMAIN` | leave empty until Part 4 |
   | `ROOT_DOMAIN` | leave empty until Part 4 |

   The build stops with a clear message if `VITE_API_URL` is missing, so the live site can never quietly turn into the demo.
3. **Settings → Networking → Generate Domain.** Copy the address.
4. Go back to the **backend** variables and set:
   - `STORE_CORS`, `AUTH_CORS` and `SELLER_CORS` to the web address.
   - `STORE_PAGE_URL` to the web address + `/store.html`.

   Redeploy the backend.
5. **Try it:**
   - Open the web address, sign up as a test seller, and set up a store.
   - Open its store page from "View my store".
   - Your admin dashboard should show the seller under **Seller finances** and **Plans & pricing**.

At this point AQENORA is live on Railway's free addresses, and shops open at `<web address>/store.html?shop=<shop>`.

## Part 4: The aqenora.com domain

1. Buy `aqenora.com`, ideally at [Cloudflare](https://www.cloudflare.com/products/registrar/) (at-cost pricing, and it's needed for sellers' own domains in Part 5). Namecheap also works.
2. **Web service:** in **Settings → Networking → Custom Domain**, add `app.aqenora.com`, `*.aqenora.com` and `stores.aqenora.com`.
3. **Backend service:** add `api.aqenora.com`.
4. **DNS records:** Railway shows a record for each domain. Add each one in your domain's DNS settings exactly as shown, then wait until Railway shows them as active.
5. **Update the variables:**
   - **Web:** `VITE_STORE_DOMAIN=aqenora.com`, `ROOT_DOMAIN=aqenora.com`, `VITE_API_URL=https://api.aqenora.com`.
   - **Backend:** `MEDUSA_BACKEND_URL` and `ADMIN_CORS` = `https://api.aqenora.com`; `STORE_CORS`, `AUTH_CORS` and `SELLER_CORS` = `https://app.aqenora.com,https://*.aqenora.com`; `STORE_DOMAIN=aqenora.com`; `STORE_CNAME_TARGET=stores.aqenora.com`.

   Redeploy both.
6. **Check:** `app.aqenora.com` opens the seller app and `<shop>.aqenora.com` opens that shop.

## Part 5: Sellers' own domains (Pro)

The seller app already guides sellers through buying a domain and adding a `CNAME www → stores.aqenora.com` record, and checks it automatically. For their domain to load securely (HTTPS), it must also be registered on the hosting side.

**Recommended: Cloudflare for SaaS.** It's free for the first 100 seller domains, and Cloudflare creates each HTTPS certificate.
1. Put `aqenora.com` on Cloudflare (Part 4).
2. In the Cloudflare dashboard, go to **SSL/TLS → Custom Hostnames**, set the fallback origin to `stores.aqenora.com`, and turn it on.
3. When a seller's domain shows **Connected** in your admin **Plans & pricing** list, add it under **Custom Hostnames** (for example `www.adirehouse.com`).

Adding domains by hand is fine for the first sellers. Once there are more, AQENORA can add them automatically through Cloudflare's API with a Cloudflare API token. That's a small follow-up job.

## Part 6: Email and payments

- **Email:**
  1. In Resend, add and verify `aqenora.com`.
  2. Create an API key.
  3. On the backend, set `RESEND_API_KEY` and `EMAIL_FROM=AQENORA <news@aqenora.com>`.

  Until then, campaign emails are only written to the server log.
- **Payments (Paystack):** buyer checkout with automatic split payments is built.
  1. In the Paystack dashboard → Settings → API Keys & Webhooks, copy the **secret key** (start with `sk_test_...` to try it safely, switch to `sk_live_...` at launch).
  2. On the backend service in Railway, set `PAYSTACK_SECRET_KEY` to it. Never paste it in chat or commit it to GitHub.
  3. In the same Paystack page, set the **Webhook URL** to `https://<your-backend>/paystack/webhook`. It records orders even if a buyer closes the page before coming back.
  4. Make sure `STORE_DOMAIN` is set (e.g. `aqenora.com`), so Paystack may send buyers back to `<shop>.aqenora.com`.

  Then each seller adds their bank account in the app (Financials → Get paid). Every sale is split by Paystack: the seller's share goes to their bank, AQENORA's commission to your Paystack account, and Paystack's fee comes out of the seller's share. Automatic Pro billing is still to come.

## Keeping it safe

- **Automatic checks:** every change on GitHub runs the checks in `.github/workflows/ci.yml`. Only merge pull requests where CI is green.
- **Backups:** Railway's PostgreSQL has backups. Turn them on under the database's **Backups** tab.
- **Demo data:** never run the demo seed script (`seed-aqenora-demo.ts`) on the live database. It creates a demo login.
- **Leaked secrets:** if a secret leaks, change it in Railway and redeploy. Changing `JWT_SECRET` logs everyone out.
