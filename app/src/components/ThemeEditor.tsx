import { useEffect, type ReactNode } from 'react';
import { contrast, FONT_KEYS, loadFonts, PRESETS, readableOn, STORE_FONTS, SWATCHES, type FontKey, type StoreDesign } from '../design';
import { useStore } from '../store';
import { StoreView } from '../storefront/StoreView';

type ColorKey = keyof StoreDesign['colors'];

const COLOR_ROWS: { key: ColorKey; label: string; hint: string }[] = [
  { key: 'background', label: 'Background', hint: 'The page behind everything' },
  { key: 'text', label: 'Text', hint: 'Your shop name, prices and words' },
  { key: 'accent', label: 'Buttons & highlights', hint: 'Buttons and the announcement bar' },
  { key: 'accent_text', label: 'Button text', hint: 'Words on your buttons' },
  { key: 'card', label: 'Product cards', hint: 'The box around each product' },
];

/** A row of choices (like Left / Centre). */
function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="ctl">
      <div className="ctl-label">{label}</div>
      <div className="seg seg-wide" role="group" aria-label={label}>
        {options.map(([v, text]) => (
          <button type="button" key={String(v)} aria-pressed={value === v} style={{ background: value === v ? '#fff' : 'transparent' }} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Section({ title, open, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="de-sec" open={open}>
      <summary>{title}</summary>
      <div className="de-sec-body">{children}</div>
    </details>
  );
}

export function ThemeEditor() {
  const { s, set, publishDesign, isMobile, h1Size, design: d, setDesign, products, fmt, shopNameShown } = useStore();
  const phone = s.pv === 'phone';

  // Load every font once so the font buttons show each typeface.
  useEffect(() => loadFonts(FONT_KEYS), []);

  const setColor = (key: ColorKey, value: string) => setDesign(x => ({ ...x, colors: { ...x.colors, [key]: value.toLowerCase() } }));

  // Readability checks (WCAG): body text 4.5:1, buttons 3:1.
  const warnings: { text: string; fix: () => void }[] = [];
  if (contrast(d.colors.text, d.colors.background) < 4.5) {
    warnings.push({ text: 'Your text is hard to read on this background.', fix: () => setColor('text', readableOn(d.colors.background)) });
  } else if (contrast(d.colors.text, d.colors.card) < 4.5) {
    warnings.push({ text: 'Product names are hard to read on the product cards.', fix: () => setColor('card', d.colors.background) });
  }
  if (contrast(d.colors.accent_text, d.colors.accent) < 3) {
    warnings.push({ text: 'Button text is hard to read on the button colour.', fix: () => setColor('accent_text', readableOn(d.colors.accent)) });
  }

  return (
    <>
      <div className="de-head">
        <h1 className="h1" style={{ fontSize: h1Size }}>Your store's look</h1>
        <button type="button" className="publish" disabled={s.busy} onClick={() => publishDesign()}>
          {s.busy ? 'Publishing…' : 'Publish changes'}
        </button>
      </div>

      <div className="editor" style={{ flexDirection: isMobile ? 'column-reverse' : 'row' }}>
        <div className="controls" style={{ flex: `0 0 ${isMobile ? 'auto' : '330px'}` }}>
          <Section title="1. Start from a style" open>
            <div className="presets">
              {PRESETS.map(p => {
                const on = p.colors.background === d.colors.background && p.colors.accent === d.colors.accent && p.fonts.heading === d.fonts.heading;
                return (
                  <button
                    type="button"
                    key={p.key}
                    className="theme-opt"
                    aria-pressed={on}
                    style={{ borderColor: on ? 'var(--ink)' : 'var(--line)' }}
                    onClick={() => setDesign(x => ({ ...x, colors: { ...p.colors }, fonts: { ...p.fonts } }))}
                  >
                    <div className="theme-swatch" style={{ background: p.colors.background, color: p.colors.text, fontFamily: STORE_FONTS[p.fonts.heading].family }}>
                      Aa<i style={{ background: p.colors.accent }} />
                    </div>
                    <div className="theme-opt-text"><span>{p.label}</span><span>{p.desc}</span></div>
                  </button>
                );
              })}
            </div>
            <div className="ctl-note">Pick one to start, then change anything below.</div>
          </Section>

          <Section title="2. Colours" open>
            {COLOR_ROWS.map(row => (
              <div className="color-row" key={row.key}>
                <label className="color-main">
                  <input type="color" value={d.colors[row.key]} onChange={e => setColor(row.key, e.target.value)} aria-label={`${row.label} colour`} />
                  <span>
                    <b>{row.label}</b>
                    <small>{row.hint}</small>
                  </span>
                  <code>{d.colors[row.key]}</code>
                </label>
                <div className="swatch-row" role="group" aria-label={`Suggested ${row.label.toLowerCase()} colours`}>
                  {SWATCHES.map(c => (
                    <button
                      type="button"
                      key={c}
                      className="mini-swatch"
                      title={c}
                      aria-label={c}
                      aria-pressed={d.colors[row.key] === c}
                      style={{ background: c, outline: d.colors[row.key] === c ? '2px solid var(--ink)' : undefined }}
                      onClick={() => setColor(row.key, c)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {warnings.map(w => (
              <div className="notice" key={w.text} role="status">
                <span>{w.text}</span>
                <button type="button" className="btn-dark btn-sm" onClick={w.fix}>Fix it</button>
              </div>
            ))}
          </Section>

          <Section title="3. Fonts">
            {(['heading', 'body'] as const).map(which => (
              <div className="ctl" key={which}>
                <div className="ctl-label">{which === 'heading' ? 'Shop name & headlines' : 'Everything else'}</div>
                <div className="font-grid font-grid-5">
                  {FONT_KEYS.map((k: FontKey) => (
                    <button
                      type="button"
                      key={k}
                      className="font-opt"
                      aria-pressed={d.fonts[which] === k}
                      title={`${STORE_FONTS[k].label}: ${STORE_FONTS[k].kind}`}
                      style={{ borderColor: d.fonts[which] === k ? 'var(--ink)' : 'var(--line)' }}
                      onClick={() => setDesign(x => ({ ...x, fonts: { ...x.fonts, [which]: k } }))}
                    >
                      <span style={{ fontFamily: STORE_FONTS[k].family }}>Aa</span>
                      <span>{STORE_FONTS[k].label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </Section>

          <Section title="4. Layout">
            <Seg label="Shop name" value={d.header.align} options={[['left', 'Left'], ['center', 'Centre']]} onChange={v => setDesign(x => ({ ...x, header: { align: v } }))} />
            <Seg label="Banner" value={d.banner.style} options={[['large', 'Big'], ['slim', 'Slim'], ['none', 'None']]} onChange={v => setDesign(x => ({ ...x, banner: { ...x.banner, style: v } }))} />
            {d.banner.style !== 'none' && (
              <>
                <label className="ctl-input">Banner headline
                  <input className="field" maxLength={80} value={d.banner.headline} placeholder="e.g. New season, made in Lagos" onChange={e => setDesign(x => ({ ...x, banner: { ...x.banner, headline: e.target.value } }))} />
                </label>
                <label className="ctl-input">Banner line under it (optional)
                  <input className="field" maxLength={160} value={d.banner.subtext} placeholder="e.g. Hand-dyed adire, shipped worldwide" onChange={e => setDesign(x => ({ ...x, banner: { ...x.banner, subtext: e.target.value } }))} />
                </label>
              </>
            )}
            <Seg label="Products per row on computers" value={d.products.columns} options={[[2, '2'], [3, '3'], [4, '4']]} onChange={v => setDesign(x => ({ ...x, products: { ...x.products, columns: v } }))} />
            <Seg label="Show how many are left" value={d.products.show_stock ? 'yes' : 'no'} options={[['yes', 'Show'], ['no', 'Hide']]} onChange={v => setDesign(x => ({ ...x, products: { ...x.products, show_stock: v === 'yes' } }))} />
            <Seg label="Corners" value={d.shape.corners} options={[['round', 'Round'], ['soft', 'Soft'], ['square', 'Square']]} onChange={v => setDesign(x => ({ ...x, shape: { ...x.shape, corners: v } }))} />
            <Seg label="Buttons" value={d.shape.buttons} options={[['pill', 'Pill'], ['rounded', 'Rounded'], ['square', 'Square']]} onChange={v => setDesign(x => ({ ...x, shape: { ...x.shape, buttons: v } }))} />
          </Section>

          <Section title="5. Words">
            <label className="ctl-input">Announcement bar (leave empty to hide)
              <input className="field" maxLength={120} placeholder="e.g. Free delivery this week" value={d.announcement} onChange={e => setDesign(x => ({ ...x, announcement: e.target.value }))} />
            </label>
            <label className="ctl-input">About us (optional)
              <textarea className="field" rows={4} maxLength={600} placeholder="Tell customers who you are and how you make your products." value={d.about} onChange={e => setDesign(x => ({ ...x, about: e.target.value }))} />
            </label>
          </Section>

          <Section title="6. Social links">
            <label className="ctl-input">Instagram name
              <input className="field" maxLength={31} placeholder="e.g. adirehouse" value={d.social.instagram} onChange={e => setDesign(x => ({ ...x, social: { ...x.social, instagram: e.target.value.replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '') } }))} />
            </label>
            <label className="ctl-input">WhatsApp number, with country code
              <input className="field" inputMode="tel" maxLength={24} placeholder="e.g. +234 801 234 5678" value={d.social.whatsapp} onChange={e => setDesign(x => ({ ...x, social: { ...x.social, whatsapp: e.target.value.replace(/\D/g, '').slice(0, 15) } }))} />
            </label>
            <div className="ctl-note">Shown at the bottom of your store so customers can follow or message you.</div>
          </Section>
          <div className="ctl-note">Logo and banner photos are coming soon.</div>
        </div>

        <div className="stage">
          <div className="seg" role="group" aria-label="Preview size">
            {([['phone', 'Phone'], ['desktop', 'Computer']] as const).map(([k, label]) => (
              <button type="button" key={k} aria-pressed={s.pv === k} style={{ background: s.pv === k ? '#fff' : 'transparent' }} onClick={() => set({ pv: k })}>
                {label}
              </button>
            ))}
          </div>
          <StoreView
            variant="preview"
            narrow={phone}
            maxWidth={phone ? 340 : '100%'}
            name={shopNameShown}
            design={d}
            items={products.slice(0, phone ? 4 : d.products.columns * 2).map((p, i) => ({ key: p.id ?? i + p.name, name: p.name, price: p.price, stock: p.stock }))}
            fmt={fmt}
          />
        </div>
      </div>
    </>
  );
}
