import { useState, type FormEvent } from 'react';
import type { Product } from '../data';
import { demoCost } from '../demo';
import { useStore } from '../store';
import { PhotoStrip } from './PhotoStrip';

export function Products() {
  const { s, set, addProduct, setProductCost, setProductImages, products, fmt, country, h1Size, live } = useStore();
  const sym = country.sym.trim();
  const [newImages, setNewImages] = useState<string[]>([]);

  const add = async (e?: FormEvent) => {
    e?.preventDefault();
    if (s.busy) return;
    if (await addProduct(newImages)) setNewImages([]);
  };

  // Demo samples show a made-up cost until the seller sets one.
  const costOf = (p: Product, i: number) => (live ? p.cost ?? null : demoCost(p, i));

  return (
    <>
      <h1 className="h1" style={{ fontSize: h1Size }}>Products</h1>
      <form className="card add" onSubmit={add}>
        <div className="add-title">Add a product</div>
        <div className="add-row">
          <input
            className="field"
            style={{ flex: '2 1 180px' }}
            aria-label="Product name"
            placeholder="Product name"
            value={s.newName}
            onChange={e => set({ newName: e.target.value })}
          />
          <input
            className="field"
            style={{ flex: '1 1 100px' }}
            aria-label="Price"
            placeholder={'Price (' + sym + ')'}
            inputMode="numeric"
            value={s.newPrice}
            onChange={e => set({ newPrice: e.target.value.replace(/[^0-9]/g, '') })}
          />
          <input
            className="field"
            style={{ flex: '1 1 100px' }}
            aria-label="Cost price (optional)"
            placeholder={'Cost (' + sym + ')'}
            inputMode="numeric"
            value={s.newCost}
            onChange={e => set({ newCost: e.target.value.replace(/[^0-9]/g, '') })}
          />
          <button type="submit" className="btn-dark" disabled={s.busy}>{s.busy ? 'Adding…' : 'Add'}</button>
        </div>
        <div className="ctl-note">Cost = what one costs you to make or buy. It's only for your Financials page; customers never see it.</div>
        <PhotoStrip images={newImages} onChange={imgs => { setNewImages(imgs); return ''; }} busy={s.busy} />
      </form>
      {products.length === 0 && <div className="empty">No products yet. Add your first one above.</div>}
      <div className="list">
        {products.map((p, i) => (
          <ProductRow key={p.id ?? i + p.name} product={p} cost={costOf(p, i)} fmt={fmt} sym={sym} onSaveCost={c => setProductCost(i, c)} onSaveImages={imgs => setProductImages(i, imgs)} />
        ))}
      </div>
    </>
  );
}

function ProductRow({ product: p, cost, fmt, sym, onSaveCost, onSaveImages }: {
  product: Product;
  cost: number | null;
  fmt: (n: number) => string;
  sym: string;
  onSaveCost: (cost: number | null) => Promise<void>;
  onSaveImages: (images: string[]) => Promise<string>;
}) {
  const [photos, setPhotos] = useState(false);
  const images = p.images ?? [];
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const margin = cost != null ? p.price - cost : null;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSaveCost(value.trim() === '' ? null : Number(value));
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="card prod prod-wrap">
      <button type="button" className="prod-thumb prod-thumb-btn" aria-label={images.length ? `Photos of ${p.name}` : `Add photos of ${p.name}`} onClick={() => setPhotos(v => !v)}>
        {images[0] ? <img src={images[0]} alt="" /> : <span>+ Photo</span>}
      </button>
      <div className="prod-info">
        <div>{p.name}</div>
        <div style={{ color: p.stock === 0 ? 'var(--alert)' : 'var(--muted)' }}>
          {p.stock === 0 ? 'Sold out' : p.stock + ' in stock'}
        </div>
        {!editing && (
          <div className="prod-cost">
            {cost != null ? (
              <>
                Cost {fmt(cost)} · <span style={{ color: margin! < 0 ? 'var(--alert)' : 'var(--go-ink)' }}>{margin! < 0 ? 'loses' : 'makes'} {fmt(Math.abs(margin!))} each</span>
                <button type="button" className="link-btn" onClick={() => { setValue(String(cost)); setEditing(true); }}>Change</button>
              </>
            ) : (
              <button type="button" className="link-btn" onClick={() => { setValue(''); setEditing(true); }}>Add cost price</button>
            )}
          </div>
        )}
        {editing && (
          <form className="cost-edit" onSubmit={save}>
            <input
              className="field"
              aria-label={`Cost price of ${p.name}`}
              placeholder={`Cost (${sym})`}
              inputMode="numeric"
              autoFocus
              value={value}
              onChange={e => setValue(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <button type="submit" className="btn-dark btn-sm" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="link-btn" onClick={() => setEditing(false)}>Cancel</button>
          </form>
        )}
      </div>
      <div className="amount">{fmt(p.price)}</div>
      <div className="prod-photos-link">
        <button type="button" className="link-btn" onClick={() => setPhotos(v => !v)}>
          {photos ? 'Done' : images.length ? `Photos (${images.length})` : 'Add photos'}
        </button>
      </div>
      {photos && <div className="prod-photos"><PhotoStrip images={images} onChange={onSaveImages} /></div>}
    </div>
  );
}
