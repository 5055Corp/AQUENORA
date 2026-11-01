import { CATEGORIES, COUNTRIES, HELP, STEPS } from '../data';
import { useStore } from '../store';
import { Help } from './Help';

const SELECTED = { borderColor: 'var(--ink)', background: '#fff' };
const UNSELECTED = { borderColor: 'var(--line)', background: 'var(--tile)' };

export function Onboarding() {
  const store = useStore();
  const { s, set, isMobile, slug, flash, h1Size, live, finishOnboarding, logOut } = store;
  const step = s.step;
  const canContinue = !s.busy && !((step === 1 && !s.shopName.trim()) || (step === 3 && !s.productName.trim()));

  const next = () => {
    if (!canContinue) return;
    if (step < 4) {
      set({ step: step + 1 });
    } else if (live) {
      finishOnboarding(false);
    } else {
      set({ screen: 'app', tab: 'home' });
      flash('Your store is live at ' + slug + '.aqenora.com');
    }
  };

  const skip = () => {
    if (s.busy) return;
    if (live) finishOnboarding(true);
    else set({ screen: 'app', tab: 'home' });
  };

  return (
    <>
      <div className="ob-top">
        <div className="wordmark" style={{ fontSize: 20 }}>AQENORA</div>
        <div className="ob-top-right">
          <div className="ob-step">Step {step + 1} of 5</div>
          {live && <button type="button" className="ob-logout" onClick={() => logOut()}>Log out</button>}
        </div>
      </div>
      <div className="ob-bars" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step + 1}>
        {STEPS.map((_, i) => (
          <div key={i} className="ob-bar" style={{ background: i <= step ? 'var(--accent)' : 'var(--line)' }} />
        ))}
      </div>

      <div
        className="ob-body"
        style={{
          gridTemplateColumns: isMobile ? 'minmax(0,1fr)' : 'minmax(0,1fr) 360px',
          padding: isMobile ? '24px 20px 32px' : '48px 40px',
        }}
      >
        <div className="ob-main">
          <div className="ob-head">
            <h1 className="h1" style={{ fontSize: h1Size }}>{STEPS[step][0]}</h1>
            <p>{STEPS[step][1]}</p>
          </div>

          {step === 0 && <StepCategory />}
          {step === 1 && <StepName />}
          {step === 2 && <StepCountry />}
          {step === 3 && <StepProduct />}
          {step === 4 && <StepPayment />}

          <div className="ob-actions">
            {step > 0 && (
              <button type="button" className="ob-back" onClick={() => set({ step: step - 1 })}>Back</button>
            )}
            <button
              type="button"
              className="btn-dark ob-next"
              style={{ opacity: canContinue ? 1 : 0.4 }}
              aria-disabled={!canContinue}
              onClick={next}
            >
              {step === 4 ? (s.busy ? 'Opening your store…' : 'Open my store dashboard') : 'Continue'}
            </button>
          </div>
          <button type="button" className="ob-skip" onClick={skip}>
            Skip setup for now
          </button>
        </div>

        {!isMobile && <LivePreview />}
      </div>
    </>
  );
}

function StepCategory() {
  const { s, set } = useStore();
  return (
    <div className="ob-cats">
      {CATEGORIES.map(label => (
        <button
          type="button"
          key={label}
          className="ob-cat"
          aria-pressed={label === s.category}
          style={label === s.category ? SELECTED : UNSELECTED}
          onClick={() => set({ category: label })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StepName() {
  const { s, set, slug } = useStore();
  return (
    <div className="ob-col">
      <input
        className="field ob-shopname"
        aria-label="Shop name"
        value={s.shopName}
        onChange={e => set({ shopName: e.target.value, nameError: '' })}
        placeholder="e.g. Adire House"
        aria-invalid={!!s.nameError}
      />
      <div className="ob-note">Your web address: <strong>{slug}.aqenora.com</strong></div>
      {s.nameError && <div className="field-error" role="alert">{s.nameError}</div>}
      <Help id="url" text={HELP.url} />
    </div>
  );
}

function StepCountry() {
  const { s, set } = useStore();
  return (
    <div className="ob-col-8">
      {COUNTRIES.map(c => (
        <button
          type="button"
          key={c.id}
          className="ob-country"
          aria-pressed={c.id === s.country}
          style={c.id === s.country ? SELECTED : UNSELECTED}
          onClick={() => set({ country: c.id })}
        >
          <span>{c.name}</span><span>{c.curName}</span>
        </button>
      ))}
    </div>
  );
}

function StepProduct() {
  const { s, set, country } = useStore();
  return (
    <div className="ob-col-12">
      <div className="ob-photo stripes">tap to add product photo</div>
      <label className="ob-label">What is it called?
        <input
          className="field ob-input"
          value={s.productName}
          onChange={e => set({ productName: e.target.value })}
          placeholder="e.g. Indigo adire kimono"
        />
      </label>
      <label className="ob-label">Price
        <div className="ob-price">
          <span>{country.sym}</span>
          <input
            value={s.productPrice}
            inputMode="numeric"
            onChange={e => set({ productPrice: e.target.value.replace(/[^0-9]/g, '') })}
          />
        </div>
      </label>
      <div className="ob-note">You can add more products, sizes and colours later.</div>
    </div>
  );
}

function StepPayment() {
  const { s, set, country } = useStore();
  const feeLine =
    'Fees in ' + country.name + ': ' + country.local +
    (s.intl ? ' Cards from abroad cost a little more (around 3–4%).' : '');
  return (
    <div className="ob-col-12">
      <div className="ob-pay" style={{ borderColor: s.paystack ? 'var(--go)' : 'var(--line)' }}>
        <div className="ob-pay-row">
          <div className="ob-pay-title">
            <div>Paystack</div>
            <div>Cards, bank transfer and USSD</div>
          </div>
          <button
            type="button"
            className="ob-pay-btn"
            style={s.paystack ? { background: 'var(--go-soft)', color: 'var(--go-ink)' } : { background: 'var(--ink)', color: '#fff' }}
            onClick={() => set({ paystack: true })}
          >
            {s.paystack ? '✓ Connected' : 'Connect'}
          </button>
        </div>
        <div className="ob-fee">{feeLine}</div>
      </div>

      <button type="button" className="ob-intl" role="switch" aria-checked={s.intl} onClick={() => set({ intl: !s.intl })}>
        <div className="ob-pay-title">
          <div>Sell to customers abroad</div>
          <div>Let buyers in the UK, US and Europe pay in dollars or euros</div>
        </div>
        <div className="switch" style={{ background: s.intl ? 'var(--go)' : 'var(--dash)' }}>
          <div style={{ left: s.intl ? 23 : 3 }} />
        </div>
      </button>
      <Help id="pay" text={HELP.pay} />
    </div>
  );
}

function LivePreview() {
  const { s, slug, shopNameShown, fmt, country } = useStore();
  const badges = [
    s.paystack && 'Pay with card or transfer',
    s.intl && 'Ships worldwide',
    'Prices in ' + country.curName,
  ].filter(Boolean) as string[];
  return (
    <div className="pv-side" aria-label="Live preview of your store">
      <div className="eyebrow">Live preview</div>
      <div className="pv-card">
        <div className="pv-url">{slug}.aqenora.com</div>
        <div className="pv-body">
          <div className="pv-name">{shopNameShown}</div>
          <div className="pv-cat">{s.category}</div>
          <div className="pv-photo stripes">product photo</div>
          <div className="pv-line">
            <span>{s.productName || 'Your first product'}</span><span>{fmt(s.productPrice)}</span>
          </div>
          <div className="pv-badges">
            {badges.map(b => <span key={b} className="pv-badge">{b}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
