import { useEffect, useRef, useState } from 'react';
import { WORLD_BY_CODE } from '../countries';
import type { Order } from '../data';
import { CARRIERS, type Carrier } from '../shipping';
import { useStore } from '../store';

const countryName = (code?: string | null) => (code ? WORLD_BY_CODE.get(code.toUpperCase())?.name ?? code : '');

function Lines({ rows }: { rows: (string | null | undefined)[] }) {
  return <>{rows.filter(Boolean).map((r, i) => <div key={i}>{r}</div>)}</>;
}

/**
 * Printable shipment details for one order: sender, recipient, contents with values (for customs),
 * the chosen service, and blanks for weight, size and waybill. Sellers print it or save it as a
 * PDF and hand it to their DHL / FedEx / UPS agent.
 */
export function ShipmentForm({ order, onClose }: { order: Order; onClose: () => void }) {
  const { shipping, s, country, fmt, fromUsd } = useStore();
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('printing-sheet');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('printing-sheet');
    };
  }, [onClose]);

  const from = shipping.from;
  const homeCode = country.id === 'DI' ? from?.country ?? '' : country.id;
  const currency = country.id === 'DI' ? 'USD' : WORLD_BY_CODE.get(country.id)?.currency ?? '';
  const items = order.items?.length
    ? order.items
    : [{ title: order.item, quantity: 1, unit_price: order.amount ?? fromUsd(order.usd) }];
  const declared = items.reduce((a, i) => a + i.quantity * i.unit_price, 0);
  const a = order.address;
  const ship = order.shipping;
  const orderNo = order.id.length > 8 ? order.id.slice(-6).toUpperCase() : order.id;
  const [opened] = useState(() => new Date());
  const date = order.created_at ? new Date(order.created_at) : opened;
  const abroad = !!a?.country && !!homeCode && a.country.toUpperCase() !== homeCode;

  return (
    <div className="sheet-overlay" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div className="sheet-bar no-print">
        <button type="button" className="btn-dark btn-sm" onClick={() => window.print()}>Print or save as PDF</button>
        <button type="button" ref={closeRef} className="btn-sm pickup-edit" onClick={onClose}>Close</button>
      </div>
      <article className="sheet">
        <header className="sheet-head">
          <div>
            <h1 id="sheet-title">Shipment details</h1>
            <p>For your courier or {ship ? CARRIERS[(ship.carrier as Carrier)] ?? 'shipping' : 'shipping'} agent{abroad ? ' · International shipment' : ''}</p>
          </div>
          <dl className="sheet-meta">
            <div><dt>Order</dt><dd>#{orderNo}</dd></div>
            <div><dt>Date</dt><dd>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
          </dl>
        </header>

        <section className="sheet-box sheet-service">
          <h2>Service</h2>
          {ship ? (
            <dl>
              <div><dt>Carrier</dt><dd>{CARRIERS[(ship.carrier as Carrier)] ?? ship.carrier}</dd></div>
              <div><dt>Service</dt><dd>{ship.name}</dd></div>
              {ship.days && <div><dt>Delivery time</dt><dd>{ship.days}</dd></div>}
              <div><dt>Shipping paid by buyer</dt><dd>{fmt(ship.price)} ({currency})</dd></div>
            </dl>
          ) : (
            <p>No delivery option was chosen; arrange delivery with the buyer.</p>
          )}
        </section>

        <div className="sheet-two">
          <section className="sheet-box">
            <h2>From (shipper)</h2>
            {from ? (
              <Lines rows={[from.name || s.shopName, from.address, [from.city, from.region, from.postal_code].filter(Boolean).join(', '), countryName(from.country), from.phone && `Tel: ${from.phone}`, s.email && `Email: ${s.email}`]} />
            ) : (
              <>
                <div>{s.shopName}</div>
                <p className="sheet-missing no-print">Add your ship-from address under Orders → Delivery & shipping to fill this in.</p>
                <div className="sheet-blank" /><div className="sheet-blank" />
              </>
            )}
          </section>
          <section className="sheet-box">
            <h2>To (recipient)</h2>
            {a ? (
              <Lines rows={[order.name, a.address, [a.city, a.region, a.postal_code].filter(Boolean).join(', '), countryName(a.country), order.phone && `Tel: ${order.phone}`, order.email && `Email: ${order.email}`]} />
            ) : (
              <>
                <div>{order.name}</div>
                <Lines rows={[order.place, order.phone && `Tel: ${order.phone}`]} />
                <div className="sheet-blank" />
              </>
            )}
          </section>
        </div>

        <section className="sheet-box">
          <h2>Contents</h2>
          <table className="sheet-table">
            <thead>
              <tr><th scope="col">Description</th><th scope="col">Qty</th><th scope="col">Unit value</th><th scope="col">Total value</th></tr>
            </thead>
            <tbody>
              {items.map((i, n) => (
                <tr key={n}><td>{i.title}</td><td>{i.quantity}</td><td>{fmt(i.unit_price)}</td><td>{fmt(i.quantity * i.unit_price)}</td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th scope="row" colSpan={3}>Total declared value ({currency})</th><td>{fmt(declared)}</td></tr>
            </tfoot>
          </table>
          <dl className="sheet-facts">
            <div><dt>Reason for export</dt><dd>Sale of goods</dd></div>
            <div><dt>Country of origin</dt><dd>{countryName(homeCode) || '__________'}</dd></div>
            {order.displayCurrency && <div><dt>Buyer's currency</dt><dd>{order.displayCurrency}</dd></div>}
          </dl>
        </section>

        <section className="sheet-box">
          <h2>To fill in at drop-off</h2>
          <dl className="sheet-fill">
            <div><dt>Number of packages</dt><dd /></div>
            <div><dt>Total weight (kg)</dt><dd /></div>
            <div><dt>Size (L × W × H, cm)</dt><dd /></div>
            <div><dt>HS code(s)</dt><dd /></div>
            <div><dt>Waybill / tracking number</dt><dd /></div>
          </dl>
        </section>

        <footer className="sheet-sign">
          <p>I declare that the information above is true and correct.</p>
          <div className="sheet-sign-row">
            <div><span>Signature</span></div>
            <div><span>Name</span></div>
            <div><span>Date</span></div>
          </div>
          <p className="sheet-small">Prepared with AQUENORA for {s.shopName || 'this shop'}.</p>
        </footer>
      </article>
    </div>
  );
}
