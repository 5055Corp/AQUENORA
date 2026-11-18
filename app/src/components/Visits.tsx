import type { VisitStats } from '../api';

const SOURCE_NAMES: Record<string, string> = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', google: 'Google',
  aquenora: 'AQUENORA search', direct: 'links typed or opened in apps', other: 'other websites',
};

/** Demo store: sample numbers so the cards can be seen before going live. */
export function demoVisits(): VisitStats {
  const by_day = [24, 36, 30, 52, 41, 68, 46];
  const days = by_day.map((_, i) => new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10));
  return { days, by_day, week: by_day.reduce((a, b) => a + b, 0), previous_week: 222, sources: { whatsapp: 172, instagram: 80, direct: 33, aquenora: 12 } };
}

/** "▲ 34%" compared with last week ("New" when there were no visits last week). */
export function visitChange(v: VisitStats): { text: string; up: boolean } | null {
  if (!v.week && !v.previous_week) return null;
  if (!v.previous_week) return { text: 'New', up: true };
  const pct = Math.round(((v.week - v.previous_week) / v.previous_week) * 100);
  return { text: `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%`, up: pct >= 0 };
}

/** Visits this week, day by day, and how many visits became orders. */
export function VisitsCards({ visits, ordersThisWeek }: { visits: VisitStats; ordersThisWeek: number }) {
  const max = Math.max(1, ...visits.by_day);
  const rate = visits.week ? (ordersThisWeek / visits.week) * 100 : 0;
  const top = Object.entries(visits.sources).sort((a, b) => b[1] - a[1]).filter(([, n]) => n > 0).slice(0, 2);
  const day = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short' });
  return (
    <>
      <section className="card vs-card" aria-labelledby="vs-week">
        <h2 id="vs-week" className="vs-title">Visits this week</h2>
        <div className="vs-sub">{visits.week} {visits.week === 1 ? 'visit' : 'visits'} · today in dark</div>
        <div className="vs-bars" role="img" aria-label={visits.by_day.map((n, i) => `${day(visits.days[i])} ${n}`).join(', ')}>
          {visits.by_day.map((n, i) => (
            <div key={i} className="vs-col">
              <div className={'vs-bar' + (i === visits.by_day.length - 1 ? ' today' : '')} style={{ height: `${Math.max(4, (n / max) * 100)}%` }} />
              <span>{day(visits.days[i]).slice(0, 2)}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="card vs-card" aria-labelledby="vs-conv">
        <h2 id="vs-conv" className="vs-title">Visits → orders</h2>
        <div className="vs-conv">
          <span>{visits.week} visits</span>
          <span>{ordersThisWeek} {ordersThisWeek === 1 ? 'order' : 'orders'}</span>
          <b>{rate.toFixed(rate && rate < 10 ? 1 : 0)}% bought</b>
        </div>
        <div className="vs-meter"><div style={{ width: `${Math.min(100, rate)}%` }} /></div>
        {top.length > 0 && visits.week > 0 && (
          <p className="vs-from">
            Most visits came from {top.map(([s, n], i) => (
              <span key={s}>{i > 0 ? ' and ' : ''}<b>{SOURCE_NAMES[s] ?? s}</b> ({Math.round((n / visits.week) * 100)}%)</span>
            ))}.
          </p>
        )}
        {visits.week === 0 && <p className="vs-from">No visits yet this week. Share your store link on WhatsApp and Instagram to get your first visitors.</p>}
      </section>
    </>
  );
}
