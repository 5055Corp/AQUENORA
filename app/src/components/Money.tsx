import { useEffect, useMemo, useState } from 'react';
import { api, ApiError, type Finance, type Period } from '../api';
import { demoSales } from '../demo';
import { summarize } from '../finance';
import { useStore } from '../store';
import { Help } from './Help';
import { LineChart } from './LineChart';

// Validated chart colours (dataviz reference palette, slots 1 and 2): pass CVD, normal-vision and 3:1 contrast on white.
const REVENUE_COLOR = '#2a78d6';
const PROFIT_COLOR = '#eb6834';

const PERIODS: [Period, string][] = [['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['all', 'All time']];

const CURRENCY: Record<string, string> = { NG: 'ngn', GH: 'ghs', ZA: 'zar', CI: 'xof', SN: 'xof', DI: 'usd' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dateLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return d ? `${d} ${MONTHS[m - 1]}` : `${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

export function Money() {
  const { s, set, live, products, country, fmt, h1Size, isMobile, flash } = useStore();
  const [period, setPeriod] = useState<Period>('30d');
  const [liveData, setLiveData] = useState<{ period: Period; data: Finance } | null>(null);
  const [error, setError] = useState('');

  // Demo mode: worked out in the browser from sample sales of the demo store's products.
  const demoData = useMemo(
    () => (live ? null : summarize(demoSales(products), s.country, CURRENCY[s.country] ?? 'ngn', period)),
    [live, products, s.country, period],
  );

  useEffect(() => {
    if (!live) return;
    let stale = false;
    api.finance(s.token, period)
      .then(data => !stale && setLiveData({ period, data }))
      .catch(e => {
        if (stale) return;
        if (e instanceof ApiError && e.status === 401) flash('Please log in again.');
        setError(e instanceof Error ? e.message : 'Could not load your numbers.');
      });
    return () => { stale = true; };
  }, [live, s.token, period, flash]);

  const data = live ? (liveData?.period === period ? liveData.data : null) : demoData;

  /** Money with a proper minus sign for losses. */
  const money = (n: number) => (n < 0 ? '−' : '') + fmt(Math.abs(n));
  const short = (n: number) => {
    const a = Math.abs(n);
    const v = a >= 1e6 ? `${+(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${+(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k` : `${Math.round(a)}`;
    return (n < 0 ? '−' : '') + country.sym + v;
  };
  const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–');

  return (
    <>
      <div className="home-head">
        <h1 className="h1" style={{ fontSize: h1Size }}>Money</h1>
        <p>What you sold, what it cost you, and what you kept.</p>
      </div>

      <div className="filters" role="group" aria-label="Time period">
        {PERIODS.map(([k, label]) => (
          <button
            type="button"
            key={k}
            aria-pressed={period === k}
            style={{ background: period === k ? 'var(--ink)' : '#fff', color: period === k ? '#fff' : 'var(--ink)', borderColor: period === k ? 'var(--ink)' : 'var(--field)' }}
            onClick={() => { setPeriod(k); setError(''); }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {!data && !error && <div className="empty">Adding up your sales…</div>}

      {data && (
        <>
          <div className="kpis">
            <div className="card stat">
              <div>Sales</div>
              <div style={{ fontSize: isMobile ? 21 : 26 }}>{money(data.totals.revenue)}</div>
              <span className="kpi-sub">{data.totals.orders} {data.totals.orders === 1 ? 'order' : 'orders'}</span>
            </div>
            <div className="card stat">
              <div>Profit</div>
              <div style={{ fontSize: isMobile ? 21 : 26, color: data.totals.profit < 0 ? 'var(--alert)' : undefined }}>{money(data.totals.profit)}</div>
              <span className="kpi-sub">{pct(data.totals.profit, data.totals.revenue)} of sales</span>
            </div>
            <div className="card stat">
              <div>Product costs</div>
              <div style={{ fontSize: isMobile ? 21 : 26 }}>{money(data.totals.cost_of_goods)}</div>
              <span className="kpi-sub">{data.totals.items_sold} items sold</span>
            </div>
            <div className="card stat">
              <div>Fees</div>
              <div style={{ fontSize: isMobile ? 21 : 26 }}>{money(data.totals.payment_fees + data.totals.platform_fees)}</div>
              <span className="kpi-sub">Paystack + AQENORA</span>
            </div>
          </div>

          {data.totals.items_missing_cost > 0 && (
            <div className="notice">
              <span>
                <strong>{data.totals.items_missing_cost} {data.totals.items_missing_cost === 1 ? 'item' : 'items'} sold</strong> {data.totals.items_missing_cost === 1 ? 'has' : 'have'} no cost price, so your profit looks higher than it really is.
              </span>
              <button type="button" className="btn-dark btn-sm" onClick={() => set({ tab: 'products' })}>Add cost prices</button>
            </div>
          )}

          {data.totals.orders === 0 ? (
            <div className="empty">
              No sales {period === 'all' ? 'yet' : 'in this period'}. When customers pay, your sales and profit show up here.
            </div>
          ) : (
            <>
              <section className="card money-card">
                <h2 className="card-title">Sales and profit</h2>
                <LineChart
                  title={`Sales and profit, ${PERIODS.find(p => p[0] === period)![1].toLowerCase()}`}
                  labels={data.series.map(p => dateLabel(p.date))}
                  series={[
                    { key: 'revenue', label: 'Sales', color: REVENUE_COLOR, values: data.series.map(p => p.revenue) },
                    { key: 'profit', label: 'Profit', color: PROFIT_COLOR, values: data.series.map(p => p.profit) },
                  ]}
                  format={money}
                  formatAxis={short}
                  height={isMobile ? 190 : 230}
                />
              </section>

              <section className="card money-card">
                <h2 className="card-title">Where your sales went</h2>
                <dl className="breakdown">
                  <div><dt>Sales</dt><dd>{money(data.totals.revenue)}</dd></div>
                  <div><dt>Product costs</dt><dd>−{fmt(data.totals.cost_of_goods)}</dd></div>
                  <div>
                    <dt>Paystack fees{data.fee_basis === 'estimate' ? ' (estimated)' : ''}</dt>
                    <dd>−{fmt(data.totals.payment_fees)}</dd>
                  </div>
                  <div><dt>AQENORA fee ({Math.round(data.commission_rate * 1000) / 10}%)</dt><dd>−{fmt(data.totals.platform_fees)}</dd></div>
                  <div className="breakdown-total"><dt>Profit</dt><dd>{money(data.totals.profit)}</dd></div>
                </dl>
                <Help
                  id="profit"
                  text="Profit is what you keep: sales minus what the products cost you, Paystack's fee for taking the payment, and AQENORA's fee. Delivery and other costs aren't included yet. Paystack fees are estimated from their published rates until payments go through AQENORA."
                />
              </section>

              <section className="card money-card">
                <h2 className="card-title">Profit by product</h2>
                <div className="lc-table-wrap">
                  <table className="ptable">
                    <thead>
                      <tr>
                        <th scope="col">Product</th>
                        <th scope="col">Sold</th>
                        <th scope="col">Sales</th>
                        <th scope="col">Profit</th>
                        {!isMobile && <th scope="col">Margin</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {data.by_product.map(p => (
                        <tr key={p.product_id ?? p.title}>
                          <th scope="row">{p.title}</th>
                          <td>{p.quantity}</td>
                          <td>{money(p.revenue)}</td>
                          <td style={{ color: p.profit < 0 ? 'var(--alert)' : undefined }}>{money(p.profit)}</td>
                          {!isMobile && <td>{pct(p.profit, p.revenue)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
          {!live && <p className="demo-note">Demo: these are sample sales, not real orders.</p>}
        </>
      )}
    </>
  );
}
