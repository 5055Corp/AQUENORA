# Putting AQENORA online (Railway)

This guide takes AQENORA from GitHub to a live website. You do the account and settings steps; everything technical is already set up in the code (`backend/Dockerfile`, `app/Dockerfile`, `railway.json` files).

**What you'll have at the end**

| Address | What it is | Railway service |
| --- | --- | --- |
| `api.aqenora.com` | The backend (data, logins, payments) and your admin dashboard at `/app` | `backend` |
| `app.aqenora.com` | The seller app | `web` |
| `<shop>.aqenora.com` | Each seller's store | `web` |
| `stores.aqenora.com` | The address sellers point their own domains at | Cloudflare Worker → `web` |

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
7. **Create your admin login** (your own login to the AQENORA admin dashboard; sellers never see it).

   **Easy way (no command line):**
   1. In Railway, open the **backend** service → **Variables** and add:
      - `ADMIN_EMAIL` = the email you'll log in with
      - `ADMIN_PASSWORD` = a strong password (at least 12 characters; use a password manager)
   2. Railway redeploys. The deploy log shows `Admin login created for you@…`.
   3. Open `https://<backend address>/app` (later `https://api.aqenora.com/app`) and log in.
   4. **Delete `ADMIN_PASSWORD`** from the variables once you're in. The login keeps working; the password just shouldn't sit in your settings.

   **To add teammates:** in the admin dashboard, go to **Settings → Users → Invite** and send them an invite. Don't share your own login.

   **Forgot the password?** Use "Forgot password" on the login page (needs email set up, Part 6), or set `ADMIN_EMAIL` to a new address with a new `ADMIN_PASSWORD` to create a fresh admin, then remove the old user under **Settings → Users**.

   **Command-line way** (if you prefer): install the [Railway CLI](https://docs.railway.com/guides/cli), run `railway login`, `railway link`, then `railway ssh --service backend` and inside it: `npx medusa user -e you@yourcompany.com -p "a-strong-password"`.

8. **A place to keep sellers' pictures** (store logos and banner photos). Without this, pictures disappear every time Railway redeploys.
   1. On the project screen, right-click the **backend** box → **Attach volume** (or press **Ctrl/Cmd + K** and type "volume").
   2. **Mount path:** type `/server/static` and confirm.
   3. Click the **backend** box → **Variables** → **+ New Variable**: name `RAILWAY_RUN_UID`, value `0`. (This lets the backend write to the volume.)
   4. Deploy. In a seller's **Store design → Logo & banner photo**, upload a picture to check it works.

   Later you can move pictures to Cloudflare R2 instead (Part 5e); the volume is fine to start.

9. **Get the publishable key:** in the admin dashboard, go to **Settings → Publishable API Keys** and copy the key that starts with `pk_`. Part 3 needs it.
10. **Set your plan prices:** in the admin dashboard, open **Plans & pricing**. Check the Pro price for each country, the commission and the trial length.

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

## Part 4: The aqenora.com domain, on Cloudflare

Cloudflare runs your domain's DNS (free), and in Part 5 it also gives sellers' own domains HTTPS.

**4a. Put the domain on Cloudflare**
1. Create a free account at [cloudflare.com](https://dash.cloudflare.com/sign-up).
2. **Buying the domain at Cloudflare:** go to **Domain Registration → Register Domains**, search `aqenora.com` and buy it. It's set up on Cloudflare automatically; skip to 4b.
3. **Already bought it elsewhere (e.g. Namecheap):** in Cloudflare click **Add a domain**, type `aqenora.com`, choose the **Free** plan. Cloudflare shows two **nameservers** (like `ada.ns.cloudflare.com`). At Namecheap: **Domain List → Manage → Nameservers → Custom DNS**, paste both, save. It can take up to 24 hours; Cloudflare emails you when it's active.

**4b. Connect the addresses to Railway**
1. **Web service** in Railway → **Settings → Networking → Custom Domain**: add `app.aqenora.com` and `*.aqenora.com`.
2. **Backend service:** add `api.aqenora.com`.
3. Railway shows a DNS record for each (usually a CNAME, and for the `*` one also an `_acme-challenge` record). In Cloudflare, go to **DNS → Records → Add record** and add each exactly as Railway shows it, with **Proxy status: DNS only (grey cloud)**. Railway issues the HTTPS certificates itself and needs the grey cloud for that.
4. Wait until Railway shows each domain as active (a few minutes).
5. **Update the variables:**
   - **Web:** `VITE_STORE_DOMAIN=aqenora.com`, `ROOT_DOMAIN=aqenora.com`, `VITE_API_URL=https://api.aqenora.com`.
   - **Backend:** `MEDUSA_BACKEND_URL` and `ADMIN_CORS` = `https://api.aqenora.com`; `STORE_CORS`, `AUTH_CORS` and `SELLER_CORS` = `https://app.aqenora.com,https://*.aqenora.com`; `STORE_DOMAIN=aqenora.com`; `STORE_CNAME_TARGET=stores.aqenora.com`.

   Redeploy both.
6. **Check:** `app.aqenora.com` opens the seller app, `<shop>.aqenora.com` opens that shop, and `api.aqenora.com/app` opens your admin login.

## Part 5: Sellers' own domains (Pro), with Cloudflare for SaaS

Sellers point `www.theirshop.com` at `stores.aqenora.com` (the app shows them how and checks it). Cloudflare gives each one an HTTPS certificate, and a small Cloudflare Worker (in this repo: `cloudflare/store-worker.js`) sends visitors to the right place. Free for the first 100 seller domains.

**5a. The address sellers point at**
1. Cloudflare → **DNS → Records → Add record**: Type `AAAA`, Name `stores`, IPv6 address `100::`, **Proxy status: Proxied (orange cloud)**. (`100::` is Cloudflare's "handled by a Worker" placeholder.)

**5b. Turn on Cloudflare for SaaS**
1. Cloudflare → **SSL/TLS → Custom Hostnames**. Enable it (you may need to add a payment card; the first 100 hostnames are free).
2. **Fallback Origin:** enter `stores.aqenora.com`, click **Add Fallback Origin**, wait until it shows **Active**.

**5c. Deploy the Worker**
1. On your computer, in this repo's `cloudflare` folder: set `WEB_ORIGIN` in `wrangler.toml` to your **web** service's Railway address (Railway → web → **Settings → Networking**, the `….up.railway.app` one, with `https://`).
2. Run `npx wrangler login`, then `npx wrangler deploy`. This creates the `aqenora-stores` Worker with the route `*/*` on `aqenora.com`.

   No command line? In Cloudflare go to **Workers & Pages → Create → Worker**, paste the contents of `cloudflare/store-worker.js`, deploy, then under **Settings → Variables** add `BACKEND_ORIGIN=https://api.aqenora.com` and `WEB_ORIGIN=<web Railway address>`, and under **Settings → Domains & Routes → Add route** use `*/*` on zone `aqenora.com`.

   The route only affects proxied (orange cloud) traffic. `app`, `api` and `*.aqenora.com` are grey cloud (4b), so they go straight to Railway and aren't touched.

**5d. Let AQENORA add seller domains automatically**
1. Cloudflare → **My Profile → API Tokens → Create Token → Custom token**. Permission: **Zone → SSL and Certificates → Edit**. Zone resources: **Include → Specific zone → aqenora.com**. Create it and copy the token (shown once).
2. Cloudflare → your `aqenora.com` overview page: copy the **Zone ID** (right-hand column).
3. Railway → **backend → Variables**: `CLOUDFLARE_API_TOKEN` = the token, `CLOUDFLARE_ZONE_ID` = the zone ID. Redeploy.

From then on, when a seller's domain is connected (their records point at `stores.aqenora.com`), AQENORA adds it to Cloudflare by itself; the seller sees "Securing your domain" for a few minutes, then it works with the padlock. Disconnecting a domain removes it again. Without the token you can still add each one by hand under **SSL/TLS → Custom Hostnames** (`www.theirshop.com`).

**Check:** in your admin, **Plans & pricing** lists connected domains; in Cloudflare, **SSL/TLS → Custom Hostnames** shows them as **Active**; `https://www.theirshop.com` opens their store.

**5e. (Optional) Store pictures on Cloudflare R2 instead of the Railway volume**
R2 is Cloudflare's file storage: 10 GB free, and pictures load fast worldwide.
1. Cloudflare → **R2 Object Storage → Create bucket**, name it `aqenora-uploads`.
2. Open the bucket → **Settings → Public access**: connect a custom domain such as `files.aqenora.com` (or allow the `r2.dev` address).
3. **R2 → Manage API tokens → Create API token**: permission **Object Read & Write**, only this bucket. Copy the **Access Key ID**, **Secret Access Key** and the **S3 endpoint** (`https://<account id>.r2.cloudflarestorage.com`).
4. Railway → **backend → Variables**: `S3_BUCKET=aqenora-uploads`, `S3_ENDPOINT=<the endpoint>`, `S3_FILE_URL=https://files.aqenora.com`, `S3_ACCESS_KEY_ID=…`, `S3_SECRET_ACCESS_KEY=…`, `S3_REGION=auto`. Deploy.

New uploads then go to R2. Pictures uploaded before stay on the volume and keep working; sellers can re-upload them any time.

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
