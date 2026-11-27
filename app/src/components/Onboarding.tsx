import { useRef, useState } from 'react';
import { prepareImage } from '../images';
import { ImageCropper } from './ImageCropper';
import { COUNTRIES, HELP, SERVICE_CATEGORY, SERVICE_STEP, SIGNUP_CATEGORIES, STEPS } from '../data';
import { useStore } from '../store';
import { Help } from './Help';
import { Logo } from './Logo';
import { defaultBookingSettings } from '../bookings';

const SELECTED = { borderColor: 'var(--ink)', background: '#fff' };
const UNSELECTED = { borderColor: 'var(--line)', background: 'var(--tile)' };

export function Onboarding() {
  const store = useStore();
  const { s, set, isMobile, slug, flash, h1Size, live, finishOnboarding, logOut } = store;
  const step = s.step;
  const services = s.category === SERVICE_CATEGORY;
  const [title, sub] = step === 3 && services ? SERVICE_STEP : STEPS[step];
  const canContinue = !s.busy && !((step === 1 && !s.shopName.trim()) || (step === 3 && !s.productName.trim()));

  const next = () => {
    if (!canContinue) return;
    if (step < 4) {
      set({ step: step + 1 });
    } else if (live) {
      finishOnboarding(false);
    } else {
      set({ screen: 'app', tab: 'home', ...(services ? { bookings: defaultBookingSettings(s.country) } : {}) });
      flash('Your store is live at ' + slug + '.aquenora.com');
    }
  };

  const skip = () => {
    if (s.busy) return;
    if (live) finishOnboarding(true);
    else set({ screen: 'app', tab: 'home', ...(services ? { bookings: defaultBookingSettings(s.country) } : {}) });
  };

  return (
    <>
      <div className="ob-top">
        <Logo style={{ fontSize: 20 }} />
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
            <h1 className="h1" style={{ fontSize: h1Size }}>{title}</h1>
            <p>{sub}</p>
          </div>

          {step === 0 && <StepCategory />}
          {step === 1 && <StepName />}
          {step === 2 && <StepCountry />}
          {step === 3 && (services ? <StepService /> : <StepProduct />)}
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
      {SIGNUP_CATEGORIES.map(label => (
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
      <div className="ob-note">Your web address: <strong>{slug}.aquenora.com</strong></div>
      {s.nameError && <div className="field-error" role="alert">{s.nameError}</div>}
      <Help id="url" text={HELP.url} />
      <InvitedBy />
    </div>
  );
}

/** "Invited by another seller?": filled in from an invite link, or typed (App Store installs lose the link). */
function InvitedBy() {
  const { s, set } = useStore();
  const [open, setOpen] = useState(!!s.referral);
  if (!open) return <button type="button" className="link-btn ob-invited-btn" onClick={() => setOpen(true)}>Invited by another seller?</button>;
  return (
    <label className="ob-invited">
      <span>Invited by (their shop's web address)</span>
      <span className="ob-invited-row">
        <input className="field" value={s.referral} placeholder="adirehouse" autoCapitalize="none" autoCorrect="off"
          onChange={e => set({ referral: e.target.value.toLowerCase().replace(/\.aquenora\.com.*$/, '').replace(/[^a-z0-9-]/g, '').slice(0, 40) })} />
        <span>.aquenora.com</span>
      </span>
    </label>
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
  const input = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  const [error, setError] = useState('');
  const use = async (file: File) => {
    setCropping(null);
    try {
      // Shrunk now and kept until the store is created (then uploaded with the product).
      set({ productPhoto: (await prepareImage(file, 'product')).dataUrl });
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not use that photo. Try another one.');
    }
  };
  return (
    <div className="ob-col-12">
      <button type="button" className={'ob-photo' + (s.productPhoto ? ' ob-photo-set' : ' stripes')} onClick={() => input.current?.click()}
        aria-label={s.productPhoto ? 'Change product photo' : 'Add a product photo'}>
        {s.productPhoto ? (
          <>
            <img src={s.productPhoto} alt="" />
            <span className="ob-photo-change">Change photo</span>
          </>
        ) : 'tap to add product photo'}
      </button>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Choose a product photo"
        onChange={e => { const f = e.target.files?.[0]; if (input.current) input.current.value = ''; if (f) setCropping(f); }} />
      {error && <div className="form-error" role="alert">{error}</div>}
      {cropping && <ImageCropper file={cropping} kind="product" onCancel={() => setCropping(null)} onDone={use} />}
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

const LENGTHS: [number, string][] = [[30, '30 min'], [60, '1 hour'], [90, '1½ hours'], [120, '2 hours'], [180, '3 hours'], [240, '4 hours']];

/** Step 4 for service providers: the first thing customers can book. */
function StepService() {
  const { s, set, country } = useStore();
  return (
    <div className="ob-col-12">
      <label className="ob-label">What do customers book?
        <input
          className="field ob-input"
          value={s.productName}
          onChange={e => set({ productName: e.target.value })}
          placeholder="e.g. Knotless braids"
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
      <div className="ob-label">How long does it take?
        <div className="ob-lengths">
          {LENGTHS.map(([m, label]) => (
            <button type="button" key={m} className="ob-length" aria-pressed={s.serviceMinutes === m}
              style={s.serviceMinutes === m ? SELECTED : UNSELECTED} onClick={() => set({ serviceMinutes: m })}>{label}</button>
          ))}
        </div>
      </div>
      <div className="ob-note">You can add more services, deposits and your opening hours later in Business.</div>
    </div>
  );
}

function StepPayment() {
  const { s, set, country, live } = useStore();
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
          {live ? (
            // The store must exist before a bank account can be connected: done from Financials.
            <span className="ob-pay-later">Next: add your bank account</span>
          ) : (
            <button
              type="button"
              className="ob-pay-btn"
              style={s.paystack ? { background: 'var(--go-soft)', color: 'var(--go-ink)' } : { background: 'var(--ink)', color: '#fff' }}
              onClick={() => set({ paystack: true })}
            >
              {s.paystack ? '✓ Connected' : 'Connect'}
            </button>
          )}
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
        <div className="pv-url">{slug}.aquenora.com</div>
        <div className="pv-body">
          <div className="pv-name">{shopNameShown}</div>
          <div className="pv-cat">{s.category}</div>
          {s.productPhoto ? <div className="pv-photo pv-photo-set"><img src={s.productPhoto} alt="" /></div> : <div className="pv-photo stripes">product photo</div>}
          <div className="pv-line">
            <span>{s.productName || (s.category === SERVICE_CATEGORY ? 'Your first service' : 'Your first product')}</span><span>{fmt(s.productPrice)}</span>
          </div>
          <div className="pv-badges">
            {badges.map(b => <span key={b} className="pv-badge">{b}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
