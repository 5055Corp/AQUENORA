import { ORDER_FILTERS, STATUS } from '../data';
import { useStore } from '../store';

export function Orders() {
  const { s, set, fmt, fromUsd, advanceOrder, h1Size } = useStore();
  const shown = s.orders.filter(o => s.filter === 'all' || o.status === s.filter);

  return (
    <>
      <h1 className="h1" style={{ fontSize: h1Size }}>Orders</h1>
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
      <div className="list">
        {shown.map(o => {
          const st = STATUS[o.status];
          return (
            <article key={o.id} className="card order">
              <div className="order-top">
                <div className="order-who">
                  <div>{o.name} <span>· #{o.id}</span></div>
                  <div>{o.item} · {o.place}{o.intl ? ' · abroad' : ''}</div>
                </div>
                <div className="amount">{o.intl ? '$' + o.usd : fmt(fromUsd(o.usd))}</div>
              </div>
              <div className="order-bottom">
                <span className="pill" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                {st.next && (
                  <button type="button" className="btn-dark btn-sm" onClick={() => advanceOrder(o.id)}>{st.action}</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
