import { useState } from 'react';
import { CONTINENTS, WORLD, WORLD_BY_CODE } from '../countries';
import { CARRIERS, CONTINENT_LIST, newOptionId, SUGGESTED_NAME, type Carrier, type ShipFrom, type Shipping, type ShippingOption } from '../shipping';
import { useStore } from '../store';

const COUNTRY_OPTIONS = [...WORLD].sort((a, b) => a.name.localeCompare(b.name));

/** Seller settings: ship-from address (printed on shipment forms) and delivery options with flat rates. */
export function ShippingSettings() {
  const { shipping, saveShipping, s, country, fmt } = useStore();
  const [draft, setDraft] = useState<Shipping>(shipping);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const saved = JSON.stringify(shipping);
  const [shown, setShown] = useState(saved);
  if (shown !== saved) {
    setShown(saved);
    setDraft(shipping);
  }
  const dirty = JSON.stringify(draft) !== saved;
  const homeId = country.id === 'DI' ? draft.from?.country ?? '' : country.id;
  const homeName = WORLD_BY_CODE.get(homeId)?.name ?? 'your country';

  const from: ShipFrom = draft.from ?? { name: s.shopName, address: '', city: '', region: '', postal_code: '', country: country.id === 'DI' ? '' : country.id, phone: '' };
  const setFrom = (patch: Partial<ShipFrom>) => { setDraft(d => ({ ...d, from: { ...from, ...patch } })); setError(''); };
  const setOption = (id: string, patch: Partial<ShippingOption>) => {
    setDraft(d => ({ ...d, options: d.options.map(o => (o.id === id ? { ...o, ...patch } : o)) }));
    setError('');
  };
  const addOption = (carrier: Carrier) => {
    const international = carrier !== 'local';
    setDraft(d => ({
      ...d,
      options: [...d.options, {
        id: newOptionId(), carrier, name: SUGGESTED_NAME[carrier], price: 0,
        days: international ? '3-5 working days' : '1-3 days',
        zone: international ? 'international' : 'domestic',
        continents: international ? ['EU', 'NA'] : [],
      }],
    }));
  };
  const removeOption = (id: string) => setDraft(d => ({ ...d, options: d.options.filter(o => o.id !== id) }));

  const save = async () => {
    const fromFilled = from.address.trim() || from.city.trim() || from.phone.trim();
    if (fromFilled && !from.country) { setError('Choose the country you ship from.'); return; }
    const msg = await saveShipping({ ...draft, from: fromFilled && from.country ? from : draft.from });
    setError(msg);
    if (!msg) setOpen(false);
  };

  const intl = shipping.options.filter(o => o.zone === 'international').length;
  const summary = shipping.options.length
    ? `${shipping.options.length} delivery option${shipping.options.length > 1 ? 's' : ''}${intl ? `, ${intl} international` : ''}.`
    : 'Add DHL, FedEx, UPS or your own courier with your flat rates. Buyers abroad choose one at checkout.';

  return (
    <section className="card pickup-card" aria-labelledby="ship-title">
      <div className="pickup-head">
        <div>
          <h2 id="ship-title" className="card-title">Delivery & shipping</h2>
          <p className="pickup-sub">{summary}</p>
        </div>
        <button type="button" className="btn-sm pickup-edit" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {open ? 'Close' : shipping.options.length ? 'Edit' : 'Set up'}
        </button>
      </div>

      {open && (
        <div className="pickup-form">
          <fieldset className="ship-set">
            <legend className="ob-label">Ship from</legend>
            <p className="pickup-sub">Printed on shipment forms as the sender. Buyers don't see it.</p>
            <div className="ship-grid">
              <label className="ob-label">Sender name
                <input className="field pickup-input" value={from.name} maxLength={100} onChange={e => setFrom({ name: e.target.value })} />
              </label>
              <label className="ob-label">Phone
                <input className="field pickup-input" type="tel" value={from.phone} maxLength={30} placeholder="+234 801 234 5678" onChange={e => setFrom({ phone: e.target.value })} />
              </label>
              <label className="ob-label ship-wide">Address
                <input className="field pickup-input" value={from.address} maxLength={200} placeholder="12 Admiralty Way, Lekki Phase 1" onChange={e => setFrom({ address: e.target.value })} />
              </label>
              <label className="ob-label">City
                <input className="field pickup-input" value={from.city} maxLength={80} onChange={e => setFrom({ city: e.target.value })} />
              </label>
              <label className="ob-label">State / region
                <input className="field pickup-input" value={from.region} maxLength={80} onChange={e => setFrom({ region: e.target.value })} />
              </label>
              <label className="ob-label">Postcode
                <input className="field pickup-input" value={from.postal_code} maxLength={20} onChange={e => setFrom({ postal_code: e.target.value })} />
              </label>
              <label className="ob-label">Country
                <select className="field pickup-input" value={from.country} onChange={e => setFrom({ country: e.target.value })}>
                  <option value="">Choose…</option>
                  {COUNTRY_OPTIONS.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </label>
            </div>
          </fieldset>

          <div className="ship-set">
            <div className="ob-label">Delivery options</div>
            {draft.options.length === 0 && (
              <p className="pickup-sub">
                No options yet: buyers in {homeName} can still order, and you arrange delivery with them. Add an international option to sell abroad.
              </p>
            )}
            {draft.options.map(o => (
              <div key={o.id} className="ship-opt">
                <div className="ship-grid">
                  <label className="ob-label">Carrier
                    <select className="field pickup-input" value={o.carrier}
                      onChange={e => {
                        const carrier = e.target.value as Carrier;
                        setOption(o.id, { carrier, name: !o.name || o.name === SUGGESTED_NAME[o.carrier] ? SUGGESTED_NAME[carrier] : o.name });
                      }}>
                      {(Object.keys(CARRIERS) as Carrier[]).map(c => <option key={c} value={c}>{CARRIERS[c]}</option>)}
                    </select>
                  </label>
                  <label className="ob-label">Name buyers see
                    <input className="field pickup-input" value={o.name} maxLength={60} onChange={e => setOption(o.id, { name: e.target.value })} />
                  </label>
                  <label className="ob-label">Your flat rate ({country.sym.trim()})
                    <input className="field pickup-input" inputMode="decimal" value={o.price ? String(o.price) : ''} placeholder="0 = free"
                      onChange={e => setOption(o.id, { price: Math.max(0, Number(e.target.value.replace(/[^0-9.]/g, '')) || 0) })} />
                  </label>
                  <label className="ob-label">Delivery time
                    <input className="field pickup-input" value={o.days} maxLength={40} placeholder="3-5 working days" onChange={e => setOption(o.id, { days: e.target.value })} />
                  </label>
                </div>
                <div className="ship-zone" role="radiogroup" aria-label={`Where ${o.name || 'this option'} delivers`}>
                  <label><input type="radio" checked={o.zone === 'domestic'} onChange={() => setOption(o.id, { zone: 'domestic', continents: [] })} /> Within {homeName}</label>
                  <label><input type="radio" checked={o.zone === 'international'} onChange={() => setOption(o.id, { zone: 'international', continents: o.continents.length ? o.continents : ['EU', 'NA'] })} /> Abroad</label>
                </div>
                {o.zone === 'international' && (
                  <div className="ship-conts" role="group" aria-label="Ships to">
                    {CONTINENT_LIST.map(c => (
                      <label key={c} className="ship-chip" data-on={o.continents.includes(c)}>
                        <input type="checkbox" checked={o.continents.includes(c)}
                          onChange={e => setOption(o.id, { continents: e.target.checked ? [...o.continents, c] : o.continents.filter(x => x !== c) })} />
                        {CONTINENTS[c]}
                      </label>
                    ))}
                  </div>
                )}
                <div className="ship-opt-foot">
                  <span>Buyers pay {o.price ? fmt(o.price) : 'nothing'} for delivery</span>
                  <button type="button" className="ship-remove" onClick={() => removeOption(o.id)}>Remove</button>
                </div>
              </div>
            ))}
            <div className="ship-add" role="group" aria-label="Add a delivery option">
              <span>Add:</span>
              {(['dhl', 'fedex', 'ups', 'aramex', 'local', 'other'] as Carrier[]).map(c => (
                <button key={c} type="button" className="ship-chip ship-add-btn" disabled={draft.options.length >= 20} onClick={() => addOption(c)}>
                  + {c === 'local' ? 'Local courier' : CARRIERS[c]}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="pickup-actions">
            <button type="button" className="btn-dark btn-sm" disabled={s.busy || !dirty} onClick={save}>
              {s.busy ? 'Saving…' : 'Save delivery options'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
