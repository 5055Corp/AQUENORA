import { useState } from 'react';
import { useStore } from '../store';
import { DAY_NAMES, DAYS, hoursText, type Day, type Pickup } from '../pickup';

/** Seller settings for in-store pickup: shop address, area, opening hours and instructions. */
export function PickupSettings() {
  const { pickup, savePickup, s } = useStore();
  const [draft, setDraft] = useState<Pickup>(pickup);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const saved = JSON.stringify(pickup);
  // Settings loaded or saved elsewhere: show them.
  const [shown, setShown] = useState(saved);
  if (shown !== saved) {
    setShown(saved);
    setDraft(pickup);
  }

  const change = (patch: Partial<Pickup>) => {
    setDraft(d => ({ ...d, ...patch }));
    setError('');
  };
  const setDay = (day: Day, h: Pickup['hours'][Day]) => change({ hours: { ...draft.hours, [day]: h } });
  const dirty = JSON.stringify(draft) !== saved;

  const save = async () => {
    const msg = await savePickup(draft);
    setError(msg);
    if (!msg) setOpen(false);
  };

  return (
    <section className="card pickup-card" aria-labelledby="pickup-title">
      <div className="pickup-head">
        <div>
          <h2 id="pickup-title" className="card-title">In-store pickup</h2>
          <p className="pickup-sub">
            {pickup.enabled
              ? `On. Customers in ${pickup.area} can collect from ${pickup.address}.`
              : 'Have a physical shop? Let nearby customers pick up their order for free during your opening hours.'}
          </p>
        </div>
        <button type="button" className="btn-sm pickup-edit" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {open ? 'Close' : pickup.enabled ? 'Edit' : 'Set up'}
        </button>
      </div>

      {open && (
        <div className="pickup-form">
          <button type="button" className="ob-intl" role="switch" aria-checked={draft.enabled} onClick={() => change({ enabled: !draft.enabled })}>
            <div className="ob-pay-title">
              <div>Offer pickup from my shop</div>
              <div>Customers choose "Pick up in store" at checkout</div>
            </div>
            <div className="switch" style={{ background: draft.enabled ? 'var(--go)' : 'var(--dash)' }}>
              <div style={{ left: draft.enabled ? 23 : 3 }} />
            </div>
          </button>

          <label className="ob-label">Shop address
            <input className="field pickup-input" value={draft.address} maxLength={200} placeholder="12 Admiralty Way, Lekki Phase 1"
              onChange={e => change({ address: e.target.value })} />
          </label>
          <label className="ob-label">Area customers will recognise
            <input className="field pickup-input" value={draft.area} maxLength={60} placeholder="Lekki, Lagos"
              onChange={e => change({ area: e.target.value })} />
          </label>

          <fieldset className="pickup-hours">
            <legend className="ob-label">Opening hours</legend>
            {DAYS.map(day => {
              const h = draft.hours[day];
              return (
                <div key={day} className="pickup-day">
                  <label className="pickup-day-name">
                    <input type="checkbox" checked={!!h}
                      onChange={e => setDay(day, e.target.checked ? { open: '09:00', close: '18:00' } : null)} />
                    {DAY_NAMES[day]}
                  </label>
                  {h ? (
                    <span className="pickup-times">
                      <input type="time" className="field" aria-label={`${DAY_NAMES[day]} opens`} value={h.open}
                        onChange={e => e.target.value && setDay(day, { ...h, open: e.target.value })} />
                      <span aria-hidden="true">to</span>
                      <input type="time" className="field" aria-label={`${DAY_NAMES[day]} closes`} value={h.close}
                        onChange={e => e.target.value && setDay(day, { ...h, close: e.target.value })} />
                    </span>
                  ) : (
                    <span className="pickup-closed">{hoursText(null)}</span>
                  )}
                </div>
              );
            })}
          </fieldset>

          <label className="ob-label">Pickup instructions (optional)
            <textarea className="field pickup-input" rows={2} maxLength={300} value={draft.instructions}
              placeholder="Bring your order number. Ask for Tola at the front desk."
              onChange={e => change({ instructions: e.target.value })} />
          </label>

          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="pickup-actions">
            <button type="button" className="btn-dark btn-sm" disabled={s.busy || !dirty} onClick={save}>
              {s.busy ? 'Saving…' : 'Save pickup settings'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
