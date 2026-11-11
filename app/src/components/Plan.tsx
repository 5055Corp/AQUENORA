import { useEffect, useState, type FormEvent } from 'react';
import { daysLeft, formatPrice } from '../plan';
import { useStore } from '../store';

const FEATURES: [string, string, string][] = [
  ['Your shop at yourshop.aqenora.com', '✓', '✓'],
  ['Your own domain, like yourshop.com', '–', '✓'],
  ['"Powered by AQENORA" on your store', 'Shown', 'Removed'],
  ['Financials: totals', '✓', '✓'],
  ['Financials: charts and profit per product', '–', '✓'],
  ['Email campaigns to past buyers', '1 a week', '1 a day'],
];

function longDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
}

/** "Plan & domain": Free vs Pro, the free trial, upgrading, and connecting an own domain. */
export function Plan() {
  const { planInfo: p, h1Size, live, startTrial, requestUpgrade, connectDomain, checkDomain, removeDomain, refreshPlan } = useStore();
  const [upgradeNote, setUpgradeNote] = useState<{ message: string; contact: string | null } | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<'' | 'waiting' | 'connected'>('');

  useEffect(() => {
    if (live) refreshPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While a domain is waiting to connect, check again every 30 seconds.
  const pending = !!p?.domain && !p.domain.connected && live;
  useEffect(() => {
    if (!pending) return;
    const t = window.setInterval(() => { checkDomain(); }, 30000);
    return () => window.clearInterval(t);
  }, [pending, checkDomain]);

  if (!p) return <div className="empty">Loading your plan…</div>;
  const { plan, price } = p;
  const priceText = formatPrice(price);

  const upgrade = async () => setUpgradeNote(await requestUpgrade());
  const addDomain = async (e: FormEvent) => {
    e.preventDefault();
    if (domainInput.trim() && (await connectDomain(domainInput))) setDomainInput('');
  };
  const check = async () => {
    setChecking(true);
    const ok = await checkDomain();
    setCheckResult(ok ? 'connected' : 'waiting');
    setChecking(false);
  };

  return (
    <>
      <div className="home-head">
        <h1 className="h1" style={{ fontSize: h1Size }}>Plan & domain</h1>
        <p>Start free. Upgrade when you want your own website address and full financial tracking.</p>
      </div>

      <section className="card money-card plan-now">
        <div className="plan-now-top">
          <div>
            <div className="eyebrow">Your plan</div>
            <div className="plan-name">{plan.plan === 'pro' ? 'Pro' : 'Free'}{plan.status === 'trial' ? ' (free trial)' : ''}</div>
          </div>
          <span className="pill" style={plan.plan === 'pro' ? { background: 'var(--go-soft)', color: 'var(--go-ink)' } : { background: 'var(--chip)', color: 'var(--muted-2)' }}>
            AQENORA fee: {plan.commission_percent}% per sale
          </span>
        </div>
        {plan.status === 'trial' && (
          <p className="plan-line">
            <strong>{daysLeft(plan.trial_ends_at)} days left</strong> of your trial (until {longDate(plan.trial_ends_at)}). "Powered by AQENORA" stays on your store until you upgrade.
          </p>
        )}
        {plan.status === 'paid' && <p className="plan-line">Pro is paid until <strong>{longDate(plan.pro_paid_until)}</strong>.</p>}
        {plan.status === 'free' && (
          <p className="plan-line">You sell for free and AQENORA keeps {p.settings.free_commission_percent}% of each sale. Pro lowers that to {p.settings.pro_commission_percent}%.</p>
        )}
      </section>

      <section className="card money-card">
        <h2 className="card-title">Free or Pro</h2>
        <div className="lc-table-wrap">
          <table className="ptable plan-table">
            <thead>
              <tr><th scope="col">What you get</th><th scope="col">Free</th><th scope="col">Pro</th></tr>
            </thead>
            <tbody>
              {FEATURES.map(([what, free, pro]) => (
                <tr key={what}><th scope="row">{what}</th><td>{free}</td><td>{pro}</td></tr>
              ))}
              <tr><th scope="row">AQENORA fee per sale</th><td>{p.settings.free_commission_percent}%</td><td>{p.settings.pro_commission_percent}%</td></tr>
              <tr className="plan-price-row"><th scope="row">Monthly price</th><td>Free</td><td>{priceText} a month</td></tr>
            </tbody>
          </table>
        </div>

        {plan.status !== 'paid' && (
          <div className="ob-actions plan-actions">
            {!plan.trial_used && (
              <button type="button" className="btn-dark ob-next" onClick={() => startTrial()}>
                Try Pro free for {p.settings.trial_days} days
              </button>
            )}
            <button type="button" className={plan.trial_used ? 'btn-dark ob-next' : 'ob-back'} onClick={upgrade}>
              Upgrade to Pro · {priceText}/month
            </button>
          </div>
        )}
        {upgradeNote && (
          <div className="notice" role="status">
            <span>
              {upgradeNote.message}
              {upgradeNote.contact && <> Message us on WhatsApp: <a href={`https://wa.me/${upgradeNote.contact.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">{upgradeNote.contact}</a>.</>}
            </span>
          </div>
        )}
      </section>

      <section className="card money-card">
        <h2 className="card-title">Your own domain</h2>
        {!plan.features.custom_domain ? (
          <>
            <p className="plan-line">Give your store its own address, like <strong>yourshop.com</strong>, still powered by AQENORA. This is part of Pro, and you can try it free.</p>
            {!plan.trial_used && <button type="button" className="btn-dark btn-sm plan-inline" onClick={() => startTrial()}>Start free trial</button>}
          </>
        ) : !p.domain ? (
          <>
            <ol className="steps">
              <li>
                <strong>Get a domain.</strong> Buy one from any domain shop (about $10–15 a year). We'll open Namecheap with your shop name already searched.
                <div><a className="btn-dark btn-sm plan-inline" href={p.buy_domain_url} target="_blank" rel="noopener noreferrer">Find a domain</a></div>
              </li>
              <li>
                <strong>Tell us which one you bought.</strong>
                <form className="add-row" onSubmit={addDomain}>
                  <input className="field" style={{ flex: '1 1 200px' }} aria-label="Your domain" placeholder="e.g. adirehouse.com" value={domainInput} onChange={e => setDomainInput(e.target.value)} />
                  <button type="submit" className="btn-dark">Connect</button>
                </form>
              </li>
            </ol>
          </>
        ) : (
          <>
            <div className="plan-now-top">
              <div className="plan-name" style={{ fontSize: 20 }}>{p.domain.name}</div>
              <span className="pill" style={p.domain.connected ? { background: 'var(--go-soft)', color: 'var(--go-ink)' } : { background: 'oklch(0.95 0.04 75)', color: 'oklch(0.45 0.1 60)' }}>
                {p.domain.connected ? 'Connected' : 'Waiting for your settings'}
              </span>
            </div>
            {p.domain.connected ? (
              <>
                <p className="plan-line">Customers can now visit your store at <strong>www.{p.domain.name}</strong>.</p>
                {p.https === 'pending' && <p className="ctl-note">Securing your domain (the padlock in the browser). This usually takes a few minutes.</p>}
                {p.https === 'error' && <p className="ctl-note">We couldn't secure your domain yet. Our team has been told and will sort it out.</p>}
              </>
            ) : (
              <>
                <p className="plan-line">At the shop where you bought <strong>{p.domain.name}</strong>, open its <strong>DNS settings</strong> and add these records exactly. We check automatically; it can take up to a few hours to work.</p>
                <div className="lc-table-wrap">
                  <table className="ptable dns-table">
                    <thead><tr><th scope="col">Type</th><th scope="col">Host / Name</th><th scope="col">Value / Points to</th></tr></thead>
                    <tbody>
                      {p.domain.records.map(r => (
                        <tr key={r.type + r.host}>
                          <th scope="row">{r.type}</th>
                          <td><code>{r.host}</code></td>
                          <td>
                            <code>{r.value}</code>
                            <button type="button" className="link-btn" onClick={() => navigator.clipboard?.writeText(r.value).catch(() => {})}>Copy</button>
                            <div className="ctl-note">{r.note}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="ob-actions">
                  <button type="button" className="btn-dark btn-sm" disabled={checking} onClick={check}>{checking ? 'Checking…' : 'Check now'}</button>
                </div>
                {checkResult === 'waiting' && <div className="ctl-note">Not connected yet. If you've just added the records, give it a little time; we'll keep checking.</div>}
              </>
            )}
            <button type="button" className="link-btn" onClick={() => { if (window.confirm(`Disconnect ${p.domain!.name}?`)) removeDomain(); }}>Disconnect this domain</button>
          </>
        )}
      </section>
      {!live && <p className="demo-note">Demo: the trial and domain here are pretend.</p>}
    </>
  );
}
