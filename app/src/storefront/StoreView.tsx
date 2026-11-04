import { ACCENTS, COUNTRIES, FONTS, THEMES, type CountryId, type FontId, type ThemeId } from '../data';

/** How a store looks: what the seller picks in "Your store's look". */
export interface StoreLook {
  name: string;
  theme: ThemeId;
  /** Index into ACCENTS. */
  accent: number;
  font: FontId;
  announce: string;
  country: CountryId;
}

export interface StoreItem {
  key: string;
  name: string;
  price: number;
  stock: number;
}

interface Props {
  look: StoreLook;
  items: StoreItem[];
  fmt: (n: number) => string;
  /** 'preview' = the small static copy in the theme editor; 'page' = the real store buyers use. */
  variant: 'preview' | 'page';
  /** CSS grid-template-columns for the product grid. */
  columns: string;
  bagCount?: number;
  onAdd?: (item: StoreItem) => void;
  onOpenBag?: () => void;
  maxWidth?: number | string;
}

/** Converts a seller's look into the colours and fonts the store is drawn with. */
export function lookStyle(look: StoreLook) {
  const th = THEMES[look.theme] ?? THEMES.harmattan;
  return {
    th,
    accent: (ACCENTS[look.accent] ?? ACCENTS[0]).color,
    font: (FONTS[look.font] ?? FONTS.classic).family,
    stripes: (n: number) => `repeating-linear-gradient(135deg,${th.sa} 0 ${n}px,${th.sb} ${n}px ${n * 2}px)`,
  };
}

export function heroLine(country: CountryId) {
  const c = COUNTRIES.find(x => x.id === country) ?? COUNTRIES[0];
  return 'New season, made in ' + (c.id === 'DI' ? 'Africa' : c.name);
}

/**
 * The store as buyers see it. The theme editor's preview and the public store page both draw
 * with this, so the preview always matches the real thing.
 */
export function StoreView({ look, items, fmt, variant, columns, bagCount = 0, onAdd, onOpenBag, maxWidth }: Props) {
  const { th, accent, font, stripes } = lookStyle(look);
  const page = variant === 'page';

  return (
    <div
      className={'sf' + (page ? ' sf-page' : '')}
      style={{ maxWidth, background: th.bg, color: th.ink }}
      aria-label={page ? undefined : 'Store preview'}
    >
      {look.announce.trim() && <div className="sf-announce" style={{ background: accent }}>{look.announce}</div>}
      <div className="sf-head">
        <div style={{ fontFamily: font }}>{look.name}</div>
        {page ? (
          <button type="button" className="sf-bag" style={{ color: th.ink }} onClick={onOpenBag}>
            Bag ({bagCount})
          </button>
        ) : (
          <div>Bag (0)</div>
        )}
      </div>
      <div className="sf-hero" style={{ background: stripes(10) }}>
        <div style={{ fontFamily: font }}>{heroLine(look.country)}</div>
      </div>
      {page && items.length === 0 && (
        <div className="sf-empty">New products are coming soon. Check back shortly.</div>
      )}
      <div className="sf-grid" style={{ gridTemplateColumns: columns }}>
        {items.map(p => {
          const soldOut = p.stock <= 0;
          return (
            <div key={p.key} className="sf-card" style={{ background: th.card }}>
              <div className="sf-img" style={{ background: stripes(8) }} />
              <div className="sf-card-name">{p.name}</div>
              <div className="sf-card-price">{fmt(p.price)}</div>
              {!page ? (
                <div className="sf-add" style={{ background: accent }}>Add to bag</div>
              ) : soldOut ? (
                <button type="button" className="sf-add" disabled style={{ background: 'transparent', color: th.ink, border: `1px solid ${th.sa}`, opacity: 0.7 }}>
                  Sold out
                </button>
              ) : (
                <button type="button" className="sf-add" style={{ background: accent }} onClick={() => onAdd?.(p)}>
                  Add to bag
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
