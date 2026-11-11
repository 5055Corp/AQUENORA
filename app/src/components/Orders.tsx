import { useCallback, useState } from 'react';
import { matchesFilter, nextStep, ORDER_FILTERS, STATUS, type Order } from '../data';
import { WORLD_BY_CODE } from '../countries';
import { ShipmentForm } from './ShipmentForm';
import { useStore } from '../store';
import { PickupSettings } from './PickupSettings';
import { ShippingSettings } from './ShippingSettings';

export function Orders() {
  const { s, set, fmt, fromUsd, advanceOrder, h1Size } = useStore();
  const shown = s.orders.filter(o => matchesFilter(o, s.filter));
  const [sheet, setSheet] = useState<Order | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);

  return (
    <>
      <h1 className="h1" style={{ fontSize: h1Size }}>Orders</h1>
      <ShippingSettings />
      <PickupSettings />
      <div className="filters" role="group" aria-label="Filter orders">
        {ORDER_FILTERS.map(([k, label]) => {
          const on = s.filter === k;
          return (
            <button
              type="button"
              key={k}
              aria-pressed={on}
              style={{ background: on ? 'var(--ink)' : '#fff', color: on ? '#fff' : 'var(--ink)', borderColor: on ? 'var(--ink)' : 'var(--field)' }}
              onClick={() => set({ filter: k })}
            >
              {label}
            </button>
          );
        })}
      </div>
      {shown.length === 0 && (
        <div className="empty">
          {s.orders.length === 0
            ? 'No orders yet. When a customer pays, their order shows up here.'
            : 'No orders here right now.'}
        </div>
      )}
      <div className="list">
        {shown.map(o => {
          const st = STATUS[o.status];
          const step = nextStep(o);
          return (
            <article key={o.id} className="card order">
              <div className="order-top">
                <div className="order-who">
                  <div>{o.name} <span>· #{o.id.length > 8 ? o.id.slice(-6).toUpperCase() : o.id}</span></div>
                  <div>{o.item}{o.address ? ` · ${o.address.city}, ${WORLD_BY_CODE.get(o.address.country)?.name ?? o.address.country}` : o.place ? ' · ' + o.place : ''}{o.intl ? ' · abroad' : ''}</div>
                  {o.shipping && <div className="order-ship">{o.shipping.name} · {fmt(o.shipping.price)} shipping</div>}
                </div>
                <div className="amount">{o.amount != null ? fmt(o.amount) : o.intl ? '$' + o.usd : fmt(fromUsd(o.usd))}</div>
              </div>
              <div className="order-bottom">
                <span className="order-pills">
                  <span className="pill" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                  {o.fulfillment === 'pickup' && <span className="pill pill-pickup">Pickup</span>}
                </span>
                <span className="order-pills">
                  {o.fulfillment !== 'pickup' && o.status !== 'canceled' && (
                    <button type="button" className="btn-sm ship-form-btn" onClick={() => setSheet(o)}>Shipping form</button>
                  )}
                  {step && (
                    <button type="button" className="btn-dark btn-sm" onClick={() => advanceOrder(o.id)}>{step.action}</button>
                  )}
                </span>
              </div>
            </article>
          );
        })}
      </div>
      {sheet && <ShipmentForm order={sheet} onClose={closeSheet} />}
    </>
  );
}
