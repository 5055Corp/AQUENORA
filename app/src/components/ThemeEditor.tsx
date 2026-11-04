import { ACCENTS, FONTS, THEMES, type FontId, type ThemeId } from '../data';
import { useStore } from '../store';
import { StoreView } from '../storefront/StoreView';

const ring = (on: boolean) => (on ? 'var(--ink)' : 'var(--line)');

export function ThemeEditor() {
  const { s, set, publishDesign, isMobile, h1Size } = useStore();
  const accent = ACCENTS[s.accent];

  return (
    <>
      <div className="de-head">
        <h1 className="h1" style={{ fontSize: h1Size }}>Your store's look</h1>
        <button type="button" className="publish" disabled={s.busy} onClick={() => publishDesign()}>
          {s.busy ? 'Publishing…' : 'Publish changes'}
        </button>
      </div>

      <div className="editor" style={{ flexDirection: isMobile ? 'column-reverse' : 'row' }}>
        <div className="controls" style={{ flex: `0 0 ${isMobile ? 'auto' : '300px'}` }}>
          <div className="ctl" role="group" aria-label="Pick a style">
            <div className="ctl-label">1. Pick a style</div>
            {(Object.entries(THEMES) as [ThemeId, (typeof THEMES)[ThemeId]][]).map(([k, t]) => (
              <button
                type="button"
                key={k}
                className="theme-opt"
                aria-pressed={s.theme === k}
                style={{ borderColor: ring(s.theme === k) }}
                onClick={() => set({ theme: k, designed: true })}
              >
                <div className="theme-swatch" style={{ background: t.bg, color: t.ink }}>Aa</div>
                <div className="theme-opt-text"><span>{t.label}</span><span>{t.desc}</span></div>
              </button>
            ))}
          </div>

          <div className="ctl" role="group" aria-label="Main colour">
            <div className="ctl-label">2. Main colour</div>
            <div className="swatches">
              {ACCENTS.map((a, i) => (
                <button
                  type="button"
                  key={a.name}
                  className="swatch"
                  title={a.name}
                  aria-label={a.name}
                  aria-pressed={s.accent === i}
                  style={{ background: a.color, borderColor: s.accent === i ? 'var(--ink)' : 'transparent' }}
                  onClick={() => set({ accent: i, designed: true })}
                />
              ))}
            </div>
            <div className="ctl-note">{accent.name}: used for buttons and your announcement bar</div>
          </div>

          <div className="ctl" role="group" aria-label="Lettering">
            <div className="ctl-label">3. Lettering</div>
            <div className="font-grid">
              {(Object.entries(FONTS) as [FontId, (typeof FONTS)[FontId]][]).map(([k, f]) => (
                <button
                  type="button"
                  key={k}
                  className="font-opt"
                  aria-pressed={s.font === k}
                  style={{ borderColor: ring(s.font === k) }}
                  onClick={() => set({ font: k, designed: true })}
                >
                  <span style={{ fontFamily: f.family }}>Aa</span><span>{f.label}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="ctl-input">4. Announcement bar
            <input
              className="field"
              placeholder="e.g. Free delivery this week"
              value={s.announce}
              onChange={e => set({ announce: e.target.value })}
            />
          </label>
        </div>

        <StorePreview />
      </div>
    </>
  );
}

function StorePreview() {
  const { s, set, products, fmt, shopNameShown } = useStore();
  const phone = s.pv === 'phone';

  return (
    <div className="stage">
      <div className="seg" role="group" aria-label="Preview size">
        {([['phone', 'Phone'], ['desktop', 'Computer']] as const).map(([k, label]) => (
          <button
            type="button"
            key={k}
            aria-pressed={s.pv === k}
            style={{ background: s.pv === k ? '#fff' : 'transparent' }}
            onClick={() => set({ pv: k })}
          >
            {label}
          </button>
        ))}
      </div>

      <StoreView
        variant="preview"
        maxWidth={phone ? 340 : '100%'}
        columns={phone ? 'repeat(2,minmax(0,1fr))' : 'repeat(4,minmax(0,1fr))'}
        look={{ name: shopNameShown, theme: s.theme, accent: s.accent, font: s.font, announce: s.announce, country: s.country }}
        items={products.slice(0, 4).map((p, i) => ({ key: p.id ?? i + p.name, name: p.name, price: p.price, stock: p.stock }))}
        fmt={fmt}
      />
    </div>
  );
}
