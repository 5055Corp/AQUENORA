"""Writes the public pages in app/public: privacy.html, support.html and seller-agreement.html
and help.html (served at app.aquenora.com/privacy, /support, /seller-agreement and /help).

Run from the app folder:  python3 scripts/legal_pages.py public
"""
import os, sys
OUT = sys.argv[1]
EMAIL = 'support@aquenora.com'
ORDERS = 'orders@aquenora.com'
# The company behind AQUENORA. Add the RC number and registered address when ready.
COMPANY = 'AQUENORA Ltd'
RC = '10023798'
ADDRESS = ''
# WhatsApp number for support, international format without + (e.g. 2348012345678). Empty = no WhatsApp button.
SUPPORT_WHATSAPP = ''
COMPANY_LINE = COMPANY + (f', RC {RC}' if RC else '') + ', a company registered in Nigeria' + (f', {ADDRESS}' if ADDRESS else '')
MARK = ('<svg viewBox="0 0 512 512" width="34" height="34" aria-hidden="true"><defs><clipPath id="l">'
        '<path d="M100 424 L146 424 L248 160 L222 160 Z"/><path d="M412 424 L366 424 L264 160 L290 160 Z"/></clipPath></defs>'
        '<g transform="rotate(-12 256 320)"><path d="M60 320 A196 50 0 0 1 452 320" fill="none" stroke="#CFC8DA" stroke-width="11" stroke-linecap="round"/></g>'
        '<path d="M100 424 L146 424 L248 160 L222 160 Z" fill="#fff"/><path d="M412 424 L366 424 L264 160 L290 160 Z" fill="#fff"/>'
        '<g clip-path="url(#l)"><g transform="rotate(-12 256 320)"><path d="M452 320 A196 50 0 0 1 60 320" fill="none" stroke="#120A1F" stroke-width="25" stroke-linecap="round"/></g></g>'
        '<g transform="rotate(-12 256 320)"><path d="M452 320 A196 50 0 0 1 60 320" fill="none" stroke="#CFC8DA" stroke-width="11" stroke-linecap="round"/></g>'
        '<path d="M256 68 L263.2 96.8 L292 104 L263.2 111.2 L256 140 L248.8 111.2 L220 104 L248.8 96.8 Z" fill="#fff"/></svg>')

CSS = """
  :root { --midnight:#120A1F; --ink:#1c1a17; --muted:#5b554c; --line:#e4ddd2; --paper:#f6f3ee; --violet:#5B21B6; color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink); font:400 16px/1.65 "Manrope",system-ui,sans-serif; }
  header { background:var(--midnight); color:#fff; }
  .wrap { max-width:760px; margin:0 auto; padding-left:max(20px,env(safe-area-inset-left)); padding-right:max(20px,env(safe-area-inset-right)); }
  .bar { padding:18px 0; font-family:"Bricolage Grotesque",sans-serif; font-weight:700; font-size:19px; letter-spacing:.04em; }
  .bar a { color:#fff; text-decoration:none; display:inline-flex; align-items:center; gap:10px; }
  .hero { padding:28px 0 36px; }
  h1 { font-family:"Bricolage Grotesque",sans-serif; font-size:clamp(30px,6vw,42px); line-height:1.1; margin:0; }
  .hero p { color:#CFC8DA; margin:10px 0 0; }
  main { padding:32px 0 56px; }
  h2 { font-family:"Bricolage Grotesque",sans-serif; font-size:22px; margin:36px 0 8px; }
  h3 { font-size:16px; margin:20px 0 4px; }
  p, li { color:#2d2a26; }
  ul { padding-left:20px; } li { margin:4px 0; }
  a { color:var(--violet); }
  .card { background:#fff; border:1px solid var(--line); border-radius:16px; padding:22px; margin-top:4px; }
  .card h2 { margin-top:0; }
  .btn { display:inline-block; background:var(--midnight); color:#fff; text-decoration:none; font-weight:700; padding:13px 22px; border-radius:999px; margin-top:6px; overflow-wrap:anywhere; }
  details { background:#fff; border:1px solid var(--line); border-radius:12px; padding:14px 18px; margin:10px 0; }
  summary { font-weight:700; cursor:pointer; }
  details p { margin:10px 0 0; }
  footer { border-top:1px solid var(--line); padding:24px 0 40px; color:var(--muted); font-size:14px; }
  footer a { margin-right:16px; }
  .search input { width:100%; font:inherit; font-size:17px; padding:14px 16px; border-radius:14px; border:1.5px solid var(--line); background:#fff; margin-top:4px; }
  .sr { position:absolute; left:-9999px; }
  .chips { display:flex; flex-wrap:wrap; gap:8px; margin:14px 0 4px; }
  .chip { background:#fff; border:1.5px solid var(--line); border-radius:999px; padding:7px 14px; font-weight:600; font-size:14px; text-decoration:none; color:var(--ink); }
  .still { margin-top:28px; background:#f3eeff; border-color:#d9ccf5; }
  .btn.wa { background:#1f9d55; }
"""

def page(title, desc, body):
    return f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title} · AQUENORA</title>
<meta name="description" content="{desc}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
<header><div class="wrap"><div class="bar"><a href="https://app.aquenora.com">{MARK}AQUENORA</a></div>
<div class="hero"><h1>{title}</h1><p>{desc}</p></div></div></header>
<main><div class="wrap">
{body}
</div></main>
<footer><div class="wrap"><a href="/support">Support</a><a href="/privacy">Privacy policy</a><a href="/help">Help centre</a><a href="/seller-agreement">Seller agreement</a><span>© {COMPANY}</span></div></footer>
</body>
</html>
"""

M = f'<a href="mailto:{EMAIL}">{EMAIL}</a>'

PRIVACY = f"""
<p><strong>Last updated: 26 November 2026</strong></p>
<p>AQUENORA is run by {COMPANY_LINE} (“AQUENORA”, “we”, “us”). AQUENORA is an online platform that lets sellers create online stores and accept payments. This policy explains what personal data we collect, why, who we share it with, and the choices you have. It covers the AQUENORA seller app (on the web and on iPhone), the AQUENORA store pages buyers visit, and our emails.</p>
<p>We follow the Nigeria Data Protection Act 2023. If you have any question about this policy, email us at {M}.</p>

<h2>1. Data we collect</h2>
<h3>From sellers</h3>
<ul>
  <li><strong>Account details:</strong> your email address and password. We store your password only in scrambled (hashed) form.</li>
  <li><strong>Store details:</strong> your shop name, web address, country, currency, products, prices, photos, store design, logo, banner, pickup address and opening hours, shipping rates, and any social links you add.</li>
  <li><strong>Payout details:</strong> your bank name and account number. We pass these to Paystack to set up payouts to you.</li>
  <li><strong>Verification documents:</strong> before a new seller can take payments, we check who they are. Registered businesses give their business name, CAC number and CAC certificate. Sellers who aren't registered give the type of ID, a photo of a government ID, a selfie and their social media pages. Only the AQUENORA team can see these. They are never shown on your store or shared with buyers.</li>
  <li><strong>Pro plan billing:</strong> if you pay for Pro, Paystack gives us a secure code for your card plus its type and last 4 digits, so we can renew your plan each month. We never see or store your full card number.</li>
  <li><strong>Survey answers:</strong> if you take part in our seller interview, the answers you choose to give.</li>
</ul>
<h3>From buyers</h3>
<ul>
  <li><strong>Order details:</strong> your name, email, phone number and delivery address (or pickup choice), what you ordered and the amount paid.</li>
  <li><strong>Payment:</strong> payments are handled by Paystack. Card and bank details go straight to Paystack. We don't receive or store them.</li>
  <li><strong>Marketing choice:</strong> whether you agreed to receive emails from the seller.</li>
</ul>
<h3>Collected automatically</h3>
<ul>
  <li>Basic technical information, such as your IP address, browser and device type, which our hosting and security services record to keep the service running and protect it from abuse.</li>
  <li>Store page visits are counted per day, with where the visit came from (for example WhatsApp or Instagram), so sellers can see how their store is doing. We don't record who visited.</li>
  <li>The seller app saves your login on your device so you stay signed in. We don't use advertising trackers or sell data to advertisers.</li>
</ul>

<h2>2. How we use it</h2>
<ul>
  <li>To run your store and process orders, payments, payouts and deliveries.</li>
  <li>To bill the Pro plan, if you choose it.</li>
  <li>To send emails about your account and orders, and campaign emails from sellers to buyers who agreed to receive them.</li>
  <li>To check that sellers are real people or businesses before they can take payments (verification), and to show buyers a Verified seller badge.</li>
  <li>To give support, prevent fraud and fake payments, and keep the service secure.</li>
  <li>To improve AQUENORA, including from survey answers.</li>
  <li>To meet our legal duties, such as tax and accounting records.</li>
</ul>
<p>We process data because it is needed to provide the service you signed up for, because you agreed (for example to marketing emails), because the law requires it, or for our legitimate interest in running a safe service.</p>

<h2>3. Sellers and their buyers</h2>
<p>Each seller is responsible for how they use their buyers' details, for example to deliver orders. AQUENORA stores and processes that data on the seller's behalf. Buyers who want to correct or remove their details can contact the seller or us.</p>

<h2>4. Who we share data with</h2>
<p>We only share data with the companies that help us run AQUENORA, and only what they need:</p>
<ul>
  <li><strong>Paystack</strong>: payments, payouts and Pro billing</li>
  <li><strong>Railway</strong>: servers and database hosting</li>
  <li><strong>Cloudflare</strong>: website delivery, security, custom domains and photo storage</li>
  <li><strong>Resend</strong>: sending emails</li>
  <li><strong>Google Fonts</strong>: the fonts on our pages</li>
</ul>
<p>We may also share data if the law requires it, or to protect our users or AQUENORA from fraud. We never sell personal data.</p>

<h2>5. Data stored outside Nigeria</h2>
<p>Some of these providers store data on servers outside Nigeria, for example in the United States or Europe. When this happens we rely on the providers' security and contract commitments to keep your data protected, as the Nigeria Data Protection Act requires.</p>

<h2>6. How long we keep it</h2>
<ul>
  <li><strong>Account and store data:</strong> until you delete your account.</li>
  <li><strong>Verification documents:</strong> until you delete your account. If you send new documents, the old ones are deleted.</li>
  <li><strong>Order and payment records:</strong> for up to 6 years, as Nigerian tax and accounting law requires. After that they are deleted.</li>
  <li><strong>Survey answers:</strong> until they are no longer needed for research.</li>
</ul>

<h2>7. Deleting your account</h2>
<p>Sellers can delete their account at any time in the app: <strong>Settings → Delete account</strong>. Your store goes offline straight away, and your products, design, customer list, verification documents and login are deleted. Any Pro plan stops and your saved card is removed. Only the order and payment records the law requires are kept. You can also ask us to delete your account by emailing {M}.</p>

<h2>8. Your rights</h2>
<p>You can ask us to: see the personal data we hold about you; correct it; delete it; stop or limit how we use it; give you a copy; or stop sending you marketing emails (every campaign email has an unsubscribe link). Email {M} and we'll reply within 30 days. If you're not happy with our answer, you can complain to the Nigeria Data Protection Commission (NDPC).</p>

<h2>9. Security</h2>
<p>All connections use encryption (HTTPS), passwords are hashed, card details stay with Paystack, and access to data is limited to what is needed to run the service.</p>

<h2>10. Children</h2>
<p>AQUENORA is for sellers aged 18 and over. We don't knowingly collect data from children.</p>

<h2>11. Changes to this policy</h2>
<p>If we make important changes, we'll update the date at the top and let sellers know in the app or by email.</p>

<h2>12. Contact</h2>
<p>{COMPANY_LINE}<br>Email: {M}</p>
"""

SUPPORT = f"""
<div class="card">
  <h2>Contact us</h2>
  <p>Questions about your store, payments or the app? Email us and a real person will reply, usually within 1 working day.</p>
  <a class="btn" href="mailto:{EMAIL}?subject=AQUENORA%20support">{EMAIL}</a>
</div>

<div class="card">
  <h2>Questions about an order?</h2>
  <p>For a delivery, a pickup or something you bought from an AQUENORA store, email our orders team. Include your order number and the store's name.</p>
  <a class="btn" href="mailto:{ORDERS}?subject=Question%20about%20my%20order">{ORDERS}</a>
</div>

<h2>Common questions</h2>
<details><summary>How do I get paid?</summary><p>Add your bank details in the app under <strong>Financials → Get paid</strong>. When a buyer pays, Paystack splits the payment automatically: your share goes straight to your bank account, usually by the next working day.</p></details>
<details><summary>A buyer says they paid but I can't see the order</summary><p>Orders only appear once Paystack confirms the payment, which protects you from fake alerts. If it still hasn't appeared after a few minutes, email <a href="mailto:{ORDERS}">{ORDERS}</a> with the buyer's name and the time they paid.</p></details>
<details><summary>How do I ship to buyers abroad?</summary><p>On the <strong>Orders</strong> page, open <strong>Shipping</strong> and set your own flat rates for DHL, FedEx, UPS, Aramex, post or local delivery, by country or continent. Each international order has a printable shipment form for your courier.</p></details>
<details><summary>How do I stop my Pro plan?</summary><p>Open <strong>Plan &amp; domain</strong> on the AQUENORA website (app.aquenora.com) and tap <strong>Stop automatic renewal</strong>. Pro stays active until the end of the month you've paid for, and you won't be charged again.</p></details>
<details><summary>How do I delete my account?</summary><p>In the app, go to <strong>Settings</strong> and tap <strong>Delete account</strong>. You can also email us to ask. See our <a href="/privacy">privacy policy</a> for what is deleted and what the law requires us to keep.</p></details>
<details><summary>I forgot my password</summary><p>Email us from the address you signed up with and we'll help you get back into your account.</p></details>
"""


HELP_TOPICS = [
  ('Selling', [
    ('How do I open a store?', 'Download AQUENORA or go to app.aquenora.com, tap <strong>Open your free store</strong>, and follow the steps: your shop name, what you sell and your first product. Your store link (yourshop.aquenora.com) works straight away.'),
    ('How long does verification take?', 'Usually 1 working day. Registered businesses send their CAC number and certificate; others send a government ID, a selfie and their social media pages. You can build your store while you wait, and you can take payments once you\'re verified. You\'ll get an email either way.'),
    ('How do I add sizes, lengths and colours?', 'In <strong>Products</strong>, tap <strong>Edit</strong> on a product (or <strong>+ Sizes, lengths, colours</strong> when adding one). Add up to 7 options. The first option can have its own price per choice (for example 12 inch ₦45,000, 20 inch ₦60,000) and its own stock; other options can add an extra amount.'),
    ('What is "made to order"?', 'Turn it on for items you make after someone buys (tailoring, wigs, cakes). Set how many days it takes. The item never shows as sold out, and buyers see when it will be ready.'),
    ('How do I make my store look like my brand?', 'Open <strong>Store design</strong>: choose colours, fonts and layout, and add your logo and banner. You see a live preview before you publish.'),
    ('What can\'t I sell?', 'Counterfeits, weapons, drugs and prescription medicines, adult products, stolen goods, live animals, dangerous goods, financial or crypto schemes, and anything illegal. See the full list in the <a href="/seller-agreement">Seller agreement</a>.'),
  ]),
  ('Getting paid', [
    ('When do I get paid?', 'When a buyer pays, Paystack splits the payment automatically and your share goes straight to your bank account, usually by the next working day. AQUENORA never holds your money.'),
    ('How do I add my bank account?', 'Go to <strong>Financials → Get paid</strong>, choose your bank and enter your account number. The account name should match your verified name or business.'),
    ('What are the fees?', 'AQUENORA keeps 3% of each sale on the Free plan, or 1% on Pro, plus Paystack\'s processing fee. Delivery charges are not included in AQUENORA\'s fee. Your Financials page shows every fee.'),
    ('I sell outside Nigeria. Can I get paid?', 'Payouts for sellers outside Nigeria are coming soon. You can build your store now, and we\'ll let you know as soon as payouts open in your country.'),
    ('A buyer says they paid but I can\'t see the order', 'Orders only appear once Paystack confirms the payment, which protects you from fake alerts. If it hasn\'t appeared after a few minutes, email ' + ORDERS + ' with the buyer\'s name and the time they paid.'),
  ]),
  ('Orders and delivery', [
    ('How do I set delivery prices?', 'In <strong>Orders → Delivery &amp; shipping</strong>, add your own rates for local delivery, DHL, FedEx, UPS, Aramex or post, by country or continent.'),
    ('How do buyers track their order?', 'Every buyer gets an email with a <strong>Track my order</strong> link. It updates when you tap the steps in Orders (packed, shipped, delivered, or ready for pickup).'),
    ('Can buyers pick up from my shop?', 'Yes. Turn on <strong>In-store pickup</strong> in Orders and add your address and opening hours. Buyers choose delivery or pickup at checkout.'),
    ('A buyer reported a problem. What now?', 'Reply within 2 working days and try to agree on a fix: a replacement, a part refund or a full refund. If you can\'t agree, the AQUENORA team looks at both sides and decides.'),
  ]),
  ('Buying', [
    ('Is it safe to buy on AQUENORA?', 'Every seller is checked before they can take payments, and payments go through Paystack, so your card details are never shared with the seller. Look for the <strong>✓ Verified seller</strong> badge.'),
    ('My order hasn\'t arrived', 'Open the <strong>Track my order</strong> link in your confirmation email to see where it is. If something is wrong, tap <strong>Problem with your order?</strong> on that page.'),
    ('How do I get a refund?', 'Report the problem from your tracking page. The seller can refund you straight to your card or bank. If you can\'t agree, AQUENORA steps in.'),
  ]),
  ('Account and safety', [
    ('I forgot my password', 'On the login screen, tap <strong>Forgot password?</strong> and we\'ll email you a link to choose a new one.'),
    ('How do I delete my account?', 'In the app, go to <strong>Settings → Delete account</strong>. Your store goes offline straight away. See our <a href="/privacy">privacy policy</a> for what is deleted and what the law requires us to keep.'),
    ('How do I stop my Pro plan?', 'Open <strong>Plan &amp; domain</strong> on app.aquenora.com and tap <strong>Stop automatic renewal</strong>. Pro stays active until the end of the month you\'ve paid for.'),
  ]),
]

def help_page():
    import re
    chips = ''.join(f'<a class="chip" href="#t{i}">{name}</a>' for i, (name, _) in enumerate(HELP_TOPICS))
    sections = ''
    for i, (name, qs) in enumerate(HELP_TOPICS):
        items = ''.join(f'<details data-q="{re.sub(r"<[^>]+>", "", q + " " + a).lower().replace(chr(34), "")}"><summary>{q}</summary><p>{a}</p></details>' for q, a in qs)
        sections += f'<section id="t{i}" class="topic"><h2>{name}</h2>{items}</section>'
    wa = f'<a class="btn wa" href="https://wa.me/{SUPPORT_WHATSAPP}">WhatsApp</a>' if SUPPORT_WHATSAPP else ''
    return f"""
<label class="search"><span class="sr">Search help</span><input id="q" type="search" placeholder="Search: payout, refund, verify…" autocomplete="off"></label>
<nav class="chips">{chips}</nav>
<p id="none" hidden>No answers match that. Try another word, or contact us below.</p>
{sections}
<div class="card still"><h2>Still need help?</h2><p>A real person replies within 1 working day.</p>
<a class="btn" href="mailto:{EMAIL}?subject=AQUENORA%20help">Email support</a> {wa}</div>
<script>
const q = document.getElementById('q'), none = document.getElementById('none');
q.addEventListener('input', () => {{
  const w = q.value.toLowerCase().trim().split(/\\s+/).filter(Boolean); let shown = 0;
  document.querySelectorAll('details').forEach(d => {{ const hit = w.every(x => d.dataset.q.includes(x)); d.hidden = !hit; d.open = w.length > 0 && hit; shown += hit; }});
  document.querySelectorAll('.topic').forEach(s => s.hidden = !s.querySelector('details:not([hidden])'));
  none.hidden = shown > 0;
}});
</script>
"""

SELLER = f"""
<p><strong>Last updated: 26 November 2026</strong></p>
<p>This agreement is between you (the seller) and {COMPANY_LINE} (“AQUENORA”, “we”, “us”). It applies when you open a store on AQUENORA, on the web or in the app. By creating a store you agree to it. Our <a href="/privacy">privacy policy</a> explains how we handle personal data.</p>

<h2>1. What AQUENORA is</h2>
<p>AQUENORA gives you an online store, a place in AQUENORA search, and checkout through Paystack. <strong>You</strong> are the seller of your products: the sale is between you and your buyer. AQUENORA is not the seller, maker or owner of the goods.</p>

<h2>2. Who can sell</h2>
<ul>
  <li>You must be 18 or over and give true details about yourself and your business.</li>
  <li>New sellers are checked before they can take payments: registered businesses with their CAC details, others with a government ID, a selfie and their social media pages. We may ask for more information, and we may refuse or remove a store at our discretion.</li>
  <li>The name on your payout bank account should match your verified identity or business.</li>
  <li>Keep your login safe. You're responsible for what happens in your account.</li>
</ul>

<h2>3. Your store and products</h2>
<ul>
  <li>Describe products honestly: real photos you own or may use, correct prices, sizes, materials and stock.</li>
  <li>If an item is made to order, give a realistic time and keep to it.</li>
  <li>Prices shown to buyers are what they pay for the items (plus any delivery you set).</li>
</ul>

<h2>4. Things you can't sell</h2>
<p>You must not list or sell:</p>
<ul>
  <li>Counterfeit or fake branded goods, or anything that copies someone else's trademark or design</li>
  <li>Weapons, ammunition, explosives or parts of them</li>
  <li>Illegal drugs, prescription-only medicines, and drug equipment</li>
  <li>Tobacco, vapes, and alcohol (unless you hold the licences the law requires)</li>
  <li>Adult or sexual content and products</li>
  <li>Stolen goods, or goods you have no right to sell</li>
  <li>Live animals, or products from protected wildlife</li>
  <li>Dangerous or hazardous materials</li>
  <li>Financial products, investment schemes, cryptocurrency or gift-card trading</li>
  <li>Anything illegal in Nigeria, or in the buyer's country when you ship abroad</li>
</ul>
<p>We may hide products, pause payments or close stores that break these rules, and report illegal activity to the authorities.</p>

<h2>5. Payments, fees and payouts</h2>
<ul>
  <li>Buyers pay through Paystack. Paystack splits each payment: your share goes to your bank account and AQUENORA's commission to us. AQUENORA never holds your money.</li>
  <li>AQUENORA's commission is a percentage of the item price (not delivery): currently 3% on the Free plan and 1% on Pro. Paystack's own processing fee is also taken from your share. Current fees are shown in the app.</li>
  <li>Pro is a monthly subscription that renews automatically until you stop it in the app. Stopping takes effect at the end of the month you've paid for.</li>
  <li>We'll tell you in advance, in the app or by email, before our fees change.</li>
  <li>You're responsible for your own taxes on your sales.</li>
</ul>

<h2>6. Orders and delivery</h2>
<ul>
  <li>An order appears in your app only once Paystack confirms the payment. Send or make items promptly, within the time you've shown.</li>
  <li>Keep order statuses up to date (packed, shipped, ready for pickup, delivered). Buyers see them on their tracking page.</li>
  <li>Use the delivery prices and couriers you've set, and share tracking numbers when you have them.</li>
</ul>

<h2>7. Returns, refunds and disputes</h2>
<ul>
  <li>Set clear returns and refund rules for your store, and follow them. You must also follow Nigerian consumer law, including the Federal Competition and Consumer Protection Act, and the law of the buyer's country when you sell abroad.</li>
  <li>If a buyer reports a problem (an item that didn't arrive, is wrong or is damaged), reply within 2 working days and try to sort it out with them.</li>
  <li>If you can't agree, AQUENORA may look at the evidence from both sides and decide. If we decide the buyer should be refunded, the refund is taken from your sale through Paystack.</li>
  <li>If a buyer's bank reverses a payment (a chargeback), the amount and any bank charges come from your sales.</li>
</ul>

<h2>8. Your buyers' personal data</h2>
<ul>
  <li>Use buyers' names, phone numbers, emails and addresses only to complete and support their orders.</li>
  <li>Send marketing emails only to buyers who said yes at checkout, using AQUENORA's campaign tool, which includes an unsubscribe link.</li>
  <li>Don't sell or share buyers' data, and keep it safe, as the Nigeria Data Protection Act 2023 requires.</li>
</ul>

<h2>9. Your content and our brand</h2>
<p>You keep ownership of your photos, logo and descriptions. You allow AQUENORA to show them in your store, in AQUENORA search and in promoting AQUENORA. The AQUENORA name and logo belong to {COMPANY}.</p>

<h2>10. Pausing or closing a store</h2>
<p>You can delete your store at any time in the app (Settings → Delete account). We may pause payments or close a store if it breaks this agreement, if we suspect fraud, or if the law requires it. Where we can, we'll tell you why and give you a chance to respond.</p>

<h2>11. Liability</h2>
<p>We work hard to keep AQUENORA running, but it's provided as it is, and we can't promise it will never be interrupted. As far as the law allows, AQUENORA is not liable for indirect losses or lost profits, and our total liability to you is limited to the fees you paid us in the 3 months before the claim. Nothing here limits rights you have under the law that can't be limited.</p>

<h2>12. Changes to this agreement</h2>
<p>We may update this agreement. We'll change the date at the top and tell you about important changes in the app or by email before they take effect. If you keep selling after that, the new version applies.</p>

<h2>13. Law</h2>
<p>This agreement is governed by the laws of the Federal Republic of Nigeria, and the courts of Nigeria will handle any dispute that we can't settle together first.</p>

<h2>14. Contact</h2>
<p>{COMPANY_LINE}<br>Email: {M}</p>
"""

open(os.path.join(OUT, 'privacy.html'), 'w').write(page('Privacy policy', 'How AQUENORA collects, uses and protects your personal data.', PRIVACY))
open(os.path.join(OUT, 'support.html'), 'w').write(page('Support', "We're here to help you sell.", SUPPORT))
open(os.path.join(OUT, 'seller-agreement.html'), 'w').write(page('Seller agreement', 'The rules for selling on AQUENORA.', SELLER))
open(os.path.join(OUT, 'help.html'), 'w').write(page('Help centre', 'Answers for sellers and buyers on AQUENORA.', help_page()))
print('ok')
