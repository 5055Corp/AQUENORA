import { useEffect, type CSSProperties } from 'react';
import { BUTTON_RADIUS, loadFonts, RADIUS, STORE_FONTS, type StoreDesign } from '../design';

export interface StoreItem {
  key: string;
  name: string;
  price: number;
  stock: number;
}

interface Props {
  name: string;
  design: StoreDesign;
  items: StoreItem[];
  fmt: (n: number) => string;
  /** 'preview' = the copy in the theme editor; 'page' = the real store buyers use. */
  variant: 'preview' | 'page';
  /** Phone-sized layout (preview "Phone", or a narrow screen). */
  narrow: boolean;
  bagCount?: number;
  onAdd?: (item: StoreItem) => void;
  onOpenBag?: () => void;
  maxWidth?: number | string;
}

/** Mixes a colour with the background (for subtle stripes and borders). */
function mix(a: string, b: string, t: number) {
  const p = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const c = [1, 3, 5].map(i => Math.round(p(a, i) * (1 - t) + p(b, i) * t).toString(16).padStart(2, '0'));
  return '#' + c.join('');
}

/**
 * The store as buyers see it. The theme editor's preview and the public store page both draw
 * with this, so the preview always matches the real thing.
 */
export function StoreView({ name, design: d, items, fmt, variant, narrow, bagCount = 0, onAdd, onOpenBag, maxWidth }: Props) {
  const page = variant === 'page';
  const { background: bg, text, accent, accent_text: onAccent, card } = d.colors;
  const heading = STORE_FONTS[d.fonts.heading].family;
  const body = STORE_FONTS[d.fonts.body].family;
  const radius = RADIUS[d.shape.corners];
  const btnRadius = BUTTON_RADIUS[d.shape.buttons];
  const sa = mix(bg, text, 0.08);
  const sb = mix(bg, text, 0.04);
  const stripes = (n: number) => `repeating-linear-gradient(135deg,${sa} 0 ${n}px,${sb} ${n}px ${n * 2}px)`;
  const columns = narrow ? 2 : d.products.columns;
  const center = d.header.align === 'center';

  useEffect(() => loadFonts([d.fonts.heading, d.fonts.body]), [d.fonts.heading, d.fonts.body]);

  const button = (extra: CSSProperties = {}): CSSProperties => ({ background: accent, color: onAccent, borderRadius: btnRadius, ...extra });
  const ig = d.social.instagram;
  const wa = d.social.whatsapp;

  return (
    <div
      className={'sf' + (page ? ' sf-page' : '')}
      style={{ maxWidth, background: bg, color: text, fontFamily: body, borderRadius: page ? 0 : radius }}
      aria-label={page ? undefined : 'Store preview'}
    >
      {d.announcement.trim() && <div className="sf-announce" style={{ background: accent, color: onAccent }}>{d.announcement}</div>}

      <div className={'sf-head' + (center ? ' sf-head-center' : '')}>
        <div className="sf-name" style={{ fontFamily: heading }}>{name}</div>
        {page ? (
          <button type="button" className="sf-bag" style={{ color: text, borderRadius: btnRadius }} onClick={onOpenBag}>
            Bag ({bagCount})
          </button>
        ) : (
          <div className="sf-bag-label">Bag (0)</div>
        )}
      </div>

      {d.banner.style !== 'none' && (
        <div
          className={'sf-hero' + (d.banner.style === 'slim' ? ' sf-hero-slim' : '') + (center ? ' sf-hero-center' : '')}
          style={{ background: stripes(10), borderRadius: radius }}
        >
          <div>
            {d.banner.headline.trim() && <div className="sf-hero-title" style={{ fontFamily: heading }}>{d.banner.headline}</div>}
            {d.banner.subtext.trim() && <div className="sf-hero-sub">{d.banner.subtext}</div>}
          </div>
        </div>
      )}

      {page && items.length === 0 && <div className="sf-empty">New products are coming soon. Check back shortly.</div>}

      <div className="sf-grid" style={{ gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` }}>
        {items.map(p => {
          const soldOut = p.stock <= 0;
          return (
            <div key={p.key} className="sf-card" style={{ background: card, borderRadius: radius }}>
              <div className="sf-img" style={{ background: stripes(8), borderRadius: Math.max(0, radius - 4) }} />
              <div className="sf-card-name">{p.name}</div>
              <div className="sf-card-price">{fmt(p.price)}</div>
              {d.products.show_stock && !soldOut && <div className="sf-card-stock">{p.stock} left</div>}
              {!page ? (
                <div className="sf-add" style={button(soldOut ? { background: 'transparent', color: text, border: `1px solid ${sa}`, opacity: 0.7 } : {})}>
                  {soldOut ? 'Sold out' : 'Add to bag'}
                </div>
              ) : soldOut ? (
                <button type="button" className="sf-add" disabled style={button({ background: 'transparent', color: text, border: `1px solid ${sa}`, opacity: 0.7 })}>
                  Sold out
                </button>
              ) : (
                <button type="button" className="sf-add" style={button()} onClick={() => onAdd?.(p)}>
                  Add to bag
                </button>
              )}
            </div>
          );
        })}
      </div>

      {(d.about.trim() || ig || wa) && (
        <div className={'sf-about' + (center ? ' sf-about-center' : '')} style={{ borderColor: sa }}>
          {d.about.trim() && (
            <>
              <div className="sf-about-title" style={{ fontFamily: heading }}>About us</div>
              <p>{d.about}</p>
            </>
          )}
          {(ig || wa) && (
            <div className="sf-social">
              {ig && (page
                ? <a href={`https://instagram.com/${ig}`} target="_blank" rel="noopener noreferrer" style={{ color: text }}>Instagram @{ig}</a>
                : <span>Instagram @{ig}</span>)}
              {wa && (page
                ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" style={{ color: text }}>Chat on WhatsApp</a>
                : <span>Chat on WhatsApp</span>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
