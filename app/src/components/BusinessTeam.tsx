// Business → working hours, blocked-off time (lunch, days off, holidays) and the team.
import { useEffect, useState } from 'react';
import { api, type BookingSettings, type Day, type Service, type Staff, type TimeBlock } from '../api';
import { blockOn, defaultBookingSettings, newId, repeatLabel, WEEK } from '../bookings';
import { useStore } from '../store';

type Hours = BookingSettings['hours'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const niceDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/** The current booking settings, and a way to save a change to them. */
function useBookingSettings() {
  const { s, saveBookings, flash } = useStore();
  const settings = s.bookings ?? defaultBookingSettings(s.country);
  const save = async (patch: Partial<BookingSettings>) => {
    const err = await saveBookings({ ...settings, ...patch });
    if (err) flash(err);
    return !err;
  };
  return { settings, save };
}

/** Mon–Sun opening times with an open/closed switch per day. */
export function HoursEditor({ hours, onChange }: { hours: Hours; onChange: (h: Hours) => void }) {
  const [draft, setDraft] = useState(hours);
  useEffect(() => setDraft(hours), [hours]);
  const setDay = (d: Day, open: boolean) => onChange({ ...draft, [d]: open ? [{ from: '09:00', to: '18:00' }] : [] });
  const setTime = (d: Day, which: 'from' | 'to', v: string) => {
    const iv = draft[d][0] ?? { from: '09:00', to: '18:00' };
    setDraft({ ...draft, [d]: [{ ...iv, [which]: v }] });
  };
  return (
    <div className="card biz-card">
      {WEEK.map(([d, label]) => {
        const iv = draft[d][0];
        return (
          <div className="biz-hours" key={d}>
            <span className="biz-day">{label}</span>
            {iv ? (
              <span className="biz-times">
                <input type="time" className="field" value={iv.from} aria-label={`${label} starts`} onChange={e => setTime(d, 'from', e.target.value)} onBlur={() => onChange(draft)} />
                <span>–</span>
                <input type="time" className="field" value={iv.to} aria-label={`${label} ends`} onChange={e => setTime(d, 'to', e.target.value)} onBlur={() => onChange(draft)} />
              </span>
            ) : <span className="biz-closed">Closed</span>}
            <input type="checkbox" role="switch" className="biz-mini" checked={!!iv} aria-label={`Open on ${label}`} onChange={e => setDay(d, e.target.checked)} />
          </div>
        );
      })}
    </div>
  );
}

/** Business → Working hours & time off. */
export function WorkingHours() {
  const { h1Size } = useStore();
  const { settings, save } = useBookingSettings();
  const [blocking, setBlocking] = useState<TimeBlock | 'new' | null>(null);
  const today = ymd(new Date());
  // Past one-off blocks drop off the list.
  const blocks = (settings.blocks ?? []).filter(b => (b.end_date ?? (b.days ? '9999' : b.date)) >= today);
  const staffName = (id?: string | null) => settings.staff?.find(m => m.id === id)?.name;

  return (
    <div className="biz">
      <h1 className="h1" style={{ fontSize: h1Size }}>Working hours</h1>
      <p className="biz-note">When customers can book you. Each team member can have their own hours too (Business → Team).</p>
      <HoursEditor hours={settings.hours} onChange={hours => save({ hours })} />

      <h2 className="biz-sec">Time off & breaks</h2>
      <div className="biz-list">
        {blocks.length === 0 && <div className="biz-row static"><span className="biz-row-text"><b>Nothing blocked yet</b><small>Block lunch, the school run, a day off or a holiday. Customers can't book those times.</small></span></div>}
        {blocks.map(b => (
          <button type="button" key={b.id} className="biz-row" onClick={() => setBlocking(b)}>
            <span className="biz-row-text">
              <b>{b.label}{b.staff_id && staffName(b.staff_id) ? ` · ${staffName(b.staff_id)}` : ''}</b>
              <small>{b.all_day ? 'All day' : `${b.from}–${b.to}`} · {b.days ? repeatLabel(b) : niceDate(b.date) + (b.end_date && b.end_date !== b.date ? ` to ${niceDate(b.end_date)}` : '')}{b.days && b.end_date ? ` until ${niceDate(b.end_date)}` : ''}</small>
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="btn-dark biz-wide" onClick={() => setBlocking('new')}>+ Block time</button>
      {blocking && <BlockTimeSheet block={blocking === 'new' ? null : blocking} onClose={() => setBlocking(null)} />}
    </div>
  );
}

const LABELS = ['Lunch', 'Break', 'School run', 'Day off', 'Holiday', 'Personal'];
type Repeat = 'once' | 'daily' | 'weekdays' | 'days';

/** Block off time once or on repeating days. Opened from Bookings (with that day) or Working hours. */
export function BlockTimeSheet({ block, day, onClose }: { block: TimeBlock | null; day?: string; onClose: () => void }) {
  const { flash } = useStore();
  const { settings, save } = useBookingSettings();
  const staff = (settings.staff ?? []).filter(m => m.active);
  const initialRepeat: Repeat = !block?.days ? 'once' : block.days.length === 7 ? 'daily' : block.days.length === 5 && !block.days.includes('sat') && !block.days.includes('sun') ? 'weekdays' : 'days';
  const [f, setF] = useState<TimeBlock>(block ?? { id: newId('blk'), label: 'Lunch', all_day: false, from: '13:00', to: '14:00', date: day ?? ymd(new Date()), end_date: null, staff_id: null });
  const [repeat, setRepeat] = useState<Repeat>(block ? initialRepeat : 'daily');
  const [days, setDays] = useState<Day[]>(block?.days ?? ['mon', 'tue', 'wed', 'thu', 'fri']);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<TimeBlock>) => { setF({ ...f, ...p }); setError(''); };

  const submit = async () => {
    if (!f.label.trim()) return setError('Name it, e.g. Lunch.');
    if (!f.all_day && f.from >= f.to) return setError('The start must be before the end.');
    if (repeat === 'days' && !days.length) return setError('Pick at least one day.');
    if (f.end_date && f.end_date < f.date) return setError('The end date must be after the start.');
    const out: TimeBlock = {
      id: f.id, label: f.label.trim(), all_day: f.all_day, from: f.all_day ? '00:00' : f.from, to: f.all_day ? '23:59' : f.to, date: f.date,
      end_date: f.end_date || null, staff_id: f.staff_id || null,
      ...(repeat === 'once' ? {} : { days: repeat === 'daily' ? WEEK.map(([d]) => d) : repeat === 'weekdays' ? ['mon', 'tue', 'wed', 'thu', 'fri'] as Day[] : days }),
    };
    setBusy(true);
    const list = settings.blocks ?? [];
    const ok = await save({ blocks: list.some(b => b.id === out.id) ? list.map(b => (b.id === out.id ? out : b)) : [...list, out] });
    setBusy(false);
    if (ok) { flash(block ? 'Saved' : 'Time blocked'); onClose(); }
  };
  const remove = async () => {
    if (!block) return;
    if (await save({ blocks: (settings.blocks ?? []).filter(b => b.id !== block.id) })) { flash('Removed'); onClose(); }
  };

  return (
    <div className="sheet-overlay vf-overlay" role="dialog" aria-modal="true" aria-label="Block time" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vf-card bk-sheet">
        <div className="vf-head"><h2>{block ? 'Blocked time' : 'Block time'}</h2><button type="button" className="vf-x" aria-label="Close" onClick={onClose}>×</button></div>
        <p className="bk-sub">Customers can't book this time.</p>
        <div className="biz-chips" role="group" aria-label="What for">
          {LABELS.map(l => <button type="button" key={l} aria-pressed={f.label === l} className={'biz-chip' + (f.label === l ? ' on' : '')} onClick={() => set({ label: l, ...(l === 'Day off' || l === 'Holiday' ? { all_day: true } : {}) })}>{l}</button>)}
        </div>
        <label className="biz-field"><span>Name</span><input className="field" value={f.label} maxLength={60} onChange={e => set({ label: e.target.value })} /></label>
        {staff.length > 0 && (
          <label className="biz-field"><span>For</span>
            <select className="field" value={f.staff_id ?? ''} onChange={e => set({ staff_id: e.target.value || null })}>
              <option value="">Everyone (the whole shop)</option>
              {staff.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        )}
        <label className="set-switch biz-switch">
          <span><b>All day</b></span>
          <input type="checkbox" role="switch" checked={f.all_day} onChange={e => set({ all_day: e.target.checked })} />
          <span className="set-switch-ui" aria-hidden="true" />
        </label>
        {!f.all_day && (
          <div className="biz-two">
            <label className="biz-field"><span>From</span><input type="time" className="field" value={f.from} onChange={e => set({ from: e.target.value })} /></label>
            <label className="biz-field"><span>To</span><input type="time" className="field" value={f.to} onChange={e => set({ to: e.target.value })} /></label>
          </div>
        )}
        <span className="biz-field"><span>Repeat</span></span>
        <div className="biz-chips" role="group" aria-label="Repeat">
          {([['once', 'Just once'], ['daily', 'Every day'], ['weekdays', 'Mon–Fri'], ['days', 'Choose days']] as const).map(([k, l]) => (
            <button type="button" key={k} aria-pressed={repeat === k} className={'biz-chip' + (repeat === k ? ' on' : '')} onClick={() => setRepeat(k)}>{l}</button>
          ))}
        </div>
        {repeat === 'days' && (
          <div className="biz-weekdays" role="group" aria-label="Days">
            {WEEK.map(([d, l]) => <button type="button" key={d} aria-pressed={days.includes(d)} className={'biz-wd' + (days.includes(d) ? ' on' : '')} onClick={() => setDays(days.includes(d) ? days.filter(x => x !== d) : [...days, d])}>{l.slice(0, 2)}</button>)}
          </div>
        )}
        <div className="biz-two">
          <label className="biz-field"><span>{repeat === 'once' ? 'Date' : 'Starting'}</span><input type="date" className="field" value={f.date} onChange={e => set({ date: e.target.value })} /></label>
          <label className="biz-field"><span>{repeat === 'once' ? 'Until (optional)' : 'Ends (optional)'}</span><input type="date" className="field" value={f.end_date ?? ''} min={f.date} onChange={e => set({ end_date: e.target.value || null })} /></label>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="button" className="btn-dark biz-wide" disabled={busy} onClick={submit}>{busy ? 'Saving…' : block ? 'Save' : 'Block this time'}</button>
        {block && <button type="button" className="link-btn biz-more" onClick={remove}>Remove</button>}
      </div>
    </div>
  );
}

/** Blocks that apply on a day (for the Bookings agenda). */
export const blocksOnDay = (s: BookingSettings | null, date: string, staffId?: string | null) =>
  (s?.blocks ?? []).filter(b => blockOn(b, date) && (!staffId || !b.staff_id || b.staff_id === staffId)).sort((a, b) => (a.all_day ? '' : a.from).localeCompare(b.all_day ? '' : b.from));

// ---------------- the team ----------------

const DEMO_SERVICES: Pick<Service, 'id' | 'name'>[] = [{ id: 'd1', name: 'Silk press' }, { id: 'd2', name: 'Knotless braids' }, { id: 'd3', name: 'Bridal hair & makeup' }];

/** Business → Team: stylists customers can book. */
export function Team() {
  const { s, live, h1Size } = useStore();
  const { settings, save } = useBookingSettings();
  const [editing, setEditing] = useState<Staff | 'new' | null>(null);
  const [services, setServices] = useState<Pick<Service, 'id' | 'name'>[]>(live ? [] : DEMO_SERVICES);
  useEffect(() => { if (live) api.services(s.token).then(r => setServices(r.services)).catch(() => {}); }, [live, s.token]);
  const team = settings.staff ?? [];

  if (editing) {
    return <StaffForm member={editing === 'new' ? null : editing} services={services} shopHours={settings.hours} onClose={() => setEditing(null)}
      onSave={async m => { if (await save({ staff: team.some(x => x.id === m.id) ? team.map(x => (x.id === m.id ? m : x)) : [...team, m] })) setEditing(null); }}
      onDelete={async id => { if (await save({ staff: team.filter(x => x.id !== id) })) setEditing(null); }} />;
  }
  return (
    <div className="biz">
      <h1 className="h1" style={{ fontSize: h1Size }}>Team</h1>
      <p className="biz-note">More than one person taking bookings? Add them here. Customers pick someone or "Anyone available", and two people can be booked at the same time. Each person can have their own hours, time off and services.</p>
      <div className="biz-list">
        {team.length === 0 && <div className="biz-row static"><span className="biz-row-text"><b>Just you for now</b><small>Add a team member, e.g. "Tolu, Senior stylist" or "Stylist 2".</small></span></div>}
        {team.map(m => (
          <button type="button" key={m.id} className="biz-row" onClick={() => setEditing(m)}>
            <span className="biz-avatar" aria-hidden="true">{m.name.trim().slice(0, 1).toUpperCase()}</span>
            <span className="biz-row-text">
              <b>{m.name}{m.active ? '' : ' (away)'}</b>
              <small>{[m.title, m.service_ids ? `${m.service_ids.length} service${m.service_ids.length === 1 ? '' : 's'}` : 'All services', m.hours ? 'Own hours' : 'Shop hours'].filter(Boolean).join(' · ')}</small>
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="btn-dark biz-wide" onClick={() => setEditing('new')}>+ Add a team member</button>
    </div>
  );
}

function StaffForm({ member, services, shopHours, onSave, onDelete, onClose }: {
  member: Staff | null; services: Pick<Service, 'id' | 'name'>[]; shopHours: Hours;
  onSave: (m: Staff) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const { h1Size } = useStore();
  const [f, setF] = useState<Staff>(member ?? { id: newId('st'), name: '', title: '', service_ids: null, hours: null, active: true });
  const [error, setError] = useState('');
  const set = (p: Partial<Staff>) => { setF({ ...f, ...p }); setError(''); };
  const does = (id: string) => !f.service_ids || f.service_ids.includes(id);
  const toggle = (id: string) => {
    // From "All services", tapping one means just that one.
    if (!f.service_ids) return set({ service_ids: [id] });
    set({ service_ids: f.service_ids.includes(id) ? f.service_ids.filter(x => x !== id) : [...f.service_ids, id] });
  };
  const submit = () => {
    if (!f.name.trim()) return setError('Add their name.');
    if (f.service_ids && !f.service_ids.length) return setError('Pick at least one service they do.');
    onSave({ ...f, name: f.name.trim(), title: f.title?.trim() || undefined });
  };
  return (
    <div className="biz">
      <button type="button" className="biz-back" onClick={onClose}>‹ Team</button>
      <h1 className="h1" style={{ fontSize: h1Size }}>{member ? member.name : 'New team member'}</h1>
      <div className="card biz-card">
        <label className="biz-field"><span>Name customers see</span><input className="field" value={f.name} maxLength={60} placeholder="e.g. Tolu, or Stylist 2" onChange={e => set({ name: e.target.value })} /></label>
        <label className="biz-field"><span>Title (optional)</span><input className="field" value={f.title ?? ''} maxLength={60} placeholder="e.g. Senior stylist" onChange={e => set({ title: e.target.value })} /></label>
        <span className="biz-field"><span>Services they do</span></span>
        <div className="biz-chips" role="group" aria-label="Services they do">
          <button type="button" aria-pressed={!f.service_ids} className={'biz-chip' + (!f.service_ids ? ' on' : '')} onClick={() => set({ service_ids: f.service_ids ? null : services.map(x => x.id) })}>All services</button>
          {services.map(x => <button type="button" key={x.id} aria-pressed={!!f.service_ids && does(x.id)} className={'biz-chip' + (f.service_ids && does(x.id) ? ' on' : '')} onClick={() => toggle(x.id)}>{x.name}</button>)}
        </div>
        <label className="set-switch biz-switch">
          <span><b>Own working hours</b><small>{f.hours ? 'Set below' : "Off: they work the shop's hours"}</small></span>
          <input type="checkbox" role="switch" checked={!!f.hours} onChange={e => set({ hours: e.target.checked ? shopHours : null })} />
          <span className="set-switch-ui" aria-hidden="true" />
        </label>
      </div>
      {f.hours && <HoursEditor hours={f.hours} onChange={hours => set({ hours })} />}
      <div className="card biz-card">
        <label className="set-switch biz-switch">
          <span><b>Taking bookings</b><small>Turn off while they're away. Their time off goes in Working hours → Block time.</small></span>
          <input type="checkbox" role="switch" checked={f.active} onChange={e => set({ active: e.target.checked })} />
          <span className="set-switch-ui" aria-hidden="true" />
        </label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button type="button" className="btn-dark biz-wide" onClick={submit}>{member ? 'Save' : 'Add to team'}</button>
        {member && <button type="button" className="link-btn biz-more" onClick={() => window.confirm(`Remove ${member.name} from your team? Their bookings stay.`) && onDelete(member.id)}>Remove from team</button>}
      </div>
    </div>
  );
}
