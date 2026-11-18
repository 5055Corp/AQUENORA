import type { OptionChoice, ProductOptions } from '../options';
import { MAX_OPTION_GROUPS } from '../options';

export interface OptionSettings {
  options: ProductOptions | null;
  madeToOrderDays: number | null;
  notePrompt: string;
}

const digits = (v: string) => v.replace(/[^0-9]/g, '');
const num = (v: string): number | null => (v.trim() === '' ? null : Number(digits(v)));

/** Problems to fix before saving, or '' when the options are fine. */
export function optionsProblem(s: OptionSettings): string {
  const groups = s.options?.groups ?? [];
  for (const g of groups) {
    if (!g.name.trim()) return 'Give every option a name, e.g. Size or Length.';
    const labels = g.choices.map(c => c.label.trim().toLowerCase()).filter(Boolean);
    if (!labels.length) return `Add at least one choice to ${g.name}.`;
    if (new Set(labels).size !== labels.length) return `${g.name} has the same choice twice.`;
  }
  const names = groups.map(g => g.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return 'Two options have the same name.';
  return '';
}

/** Drops empty choice rows before saving. */
export function cleanSettings(s: OptionSettings): OptionSettings {
  const groups = (s.options?.groups ?? [])
    .map(g => ({ name: g.name.trim(), choices: g.choices.filter(c => c.label.trim()).map(c => ({ ...c, label: c.label.trim() })) }))
    .filter(g => g.name || g.choices.length);
  return {
    options: groups.length ? { groups, ...(s.options?.stock_per_choice ? { stock_per_choice: true } : {}) } : null,
    madeToOrderDays: s.madeToOrderDays,
    notePrompt: s.notePrompt.trim(),
  };
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={'oe-switch' + (on ? ' on' : '')} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

/**
 * Sizes, lengths, colours (up to 7 options, named by the seller), made to order, and a notes box
 * for buyers. Used by "Add a product" and "Edit product".
 */
export function OptionsEditor({ value, onChange, sym, basePrice }: {
  value: OptionSettings;
  onChange: (v: OptionSettings) => void;
  sym: string;
  basePrice: number;
}) {
  const groups = value.options?.groups ?? [];
  const perChoice = !!value.options?.stock_per_choice;
  const setGroups = (next: ProductOptions['groups'], stockPerChoice = perChoice) =>
    onChange({ ...value, options: next.length ? { groups: next, ...(stockPerChoice ? { stock_per_choice: true } : {}) } : null });
  const setGroup = (gi: number, g: ProductOptions['groups'][number]) => setGroups(groups.map((x, i) => (i === gi ? g : x)));
  const setChoice = (gi: number, ci: number, c: OptionChoice) =>
    setGroup(gi, { ...groups[gi], choices: groups[gi].choices.map((x, i) => (i === ci ? c : x)) });

  return (
    <div className="oe">
      <div className="oe-card">
        <div className="oe-head">
          <b>Options</b>
          <span className="oe-muted">up to {MAX_OPTION_GROUPS}</span>
        </div>
        <div className="oe-muted">Sizes, lengths, colours, anything buyers choose. You name them.</div>

        {groups.map((g, gi) => (
          <fieldset key={gi} className="oe-group">
            <legend className="sr-only">Option {gi + 1}</legend>
            <div className="oe-row">
              <input className="field oe-name" aria-label={`Option ${gi + 1} name`} placeholder={gi === 0 ? 'e.g. Length or Size' : 'e.g. Colour'} maxLength={30}
                value={g.name} onChange={e => setGroup(gi, { ...g, name: e.target.value })} />
              <button type="button" className="link-btn oe-remove" onClick={() => setGroups(groups.filter((_, i) => i !== gi), gi === 0 ? false : perChoice)}>Remove</button>
            </div>
            <div className={'oe-grid' + (gi === 0 && perChoice ? ' three' : '')}>
              <span className="oe-hd">Choice</span>
              <span className="oe-hd">{gi === 0 ? `Price ${sym}` : `Extra ${sym} (optional)`}</span>
              {gi === 0 && perChoice && <span className="oe-hd">Stock</span>}
              <span />
              {g.choices.map((c, ci) => (
                <div key={ci} className="oe-choice">
                  <input className="field" aria-label={`${g.name || 'Option'} choice ${ci + 1}`} placeholder={gi === 0 ? 'e.g. 12 inch' : 'e.g. Black'} maxLength={40}
                    value={c.label} onChange={e => setChoice(gi, ci, { ...c, label: e.target.value })} />
                  {gi === 0 ? (
                    <input className="field" inputMode="numeric" aria-label={`Price for ${c.label || 'this choice'}`} placeholder={String(basePrice || '')}
                      value={c.price ?? ''} onChange={e => setChoice(gi, ci, { ...c, price: num(e.target.value) })} />
                  ) : (
                    <input className="field" inputMode="numeric" aria-label={`Extra for ${c.label || 'this choice'}`} placeholder="+0"
                      value={c.extra ?? ''} onChange={e => setChoice(gi, ci, { ...c, extra: num(e.target.value) })} />
                  )}
                  {gi === 0 && perChoice && (
                    <input className="field" inputMode="numeric" aria-label={`Stock of ${c.label || 'this choice'}`} placeholder="0"
                      value={c.stock ?? ''} onChange={e => setChoice(gi, ci, { ...c, stock: num(e.target.value) })} />
                  )}
                  <button type="button" className="oe-x" aria-label={`Remove ${c.label || 'choice'}`}
                    onClick={() => setGroup(gi, { ...g, choices: g.choices.filter((_, i) => i !== ci) })}>×</button>
                </div>
              ))}
            </div>
            <button type="button" className="link-btn" onClick={() => setGroup(gi, { ...g, choices: [...g.choices, { label: '' }] })}>+ Add a choice</button>
            {gi === 0 && (
              <label className="oe-toggle">
                <Switch on={perChoice} label="Track stock for each choice" onChange={on => setGroups(groups, on)} />
                <span>Track stock for each choice</span>
              </label>
            )}
          </fieldset>
        ))}

        {groups.length < MAX_OPTION_GROUPS && (
          <button type="button" className="link-btn oe-add" onClick={() => setGroups([...groups, { name: '', choices: [{ label: '' }, { label: '' }] }])}>
            {groups.length ? '+ Add another option (e.g. Colour, Lace, Density)' : '+ Add an option (e.g. Size, Length, Colour)'}
          </button>
        )}
      </div>

      <div className="oe-card">
        <div className="oe-head">
          <div><b>Made to order</b><div className="oe-muted">Never shows as sold out</div></div>
          <Switch on={!!value.madeToOrderDays} label="Made to order" onChange={on => onChange({ ...value, madeToOrderDays: on ? 7 : null })} />
        </div>
        {!!value.madeToOrderDays && (
          <label className="oe-days">Ready in
            <input className="field" inputMode="numeric" aria-label="Days to make it" value={value.madeToOrderDays}
              onChange={e => onChange({ ...value, madeToOrderDays: Math.min(180, Math.max(1, Number(digits(e.target.value)) || 1)) })} />
            days
          </label>
        )}
      </div>

      <div className="oe-card">
        <div className="oe-head">
          <div><b>Ask buyers for details</b><div className="oe-muted">A box at checkout for measurements or requests</div></div>
          <Switch on={value.notePrompt !== ''} label="Ask buyers for details"
            onChange={on => onChange({ ...value, notePrompt: on ? 'Your measurements, or any special requests' : '' })} />
        </div>
        {value.notePrompt !== '' && (
          <input className="field oe-prompt" aria-label="Question for buyers" maxLength={120} value={value.notePrompt}
            onChange={e => onChange({ ...value, notePrompt: e.target.value })} />
        )}
      </div>
    </div>
  );
}
