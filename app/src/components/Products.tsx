import { useState, type FormEvent } from 'react';
import type { Product } from '../data';
import { demoCost } from '../demo';
import { useStore } from '../store';
import { PhotoStrip } from './PhotoStrip';
import { cleanSettings, OptionsEditor, optionsProblem, type OptionSettings } from './OptionsEditor';
import { fromPrice, variesInPrice } from '../options';

export function Products() {
  const { s, set, addProduct, setProductCost, setProductImages, products, fmt, country, h1Size, live } = useStore();
  const [editing, setEditing] = useState<number | null>(null);
  const sym = country.sym.trim();
  const [newImages, setNewImages] = useState<string[]>([]);
  const emptyExtras: OptionSettings = { options: null, madeToOrderDays: null, notePrompt: '' };
  const [more, setMore] = useState(false);
  const [extras, setExtras] = useState<OptionSettings>(emptyExtras);
  const [addError, setAddError] = useState('');

  const add = async (e?: FormEvent) => {
    e?.preventDefault();
    if (s.busy) return;
    const problem = optionsProblem(cleanSettings(extras));
    if (problem) return setAddError(problem);
    setAddError('');
    const clean = cleanSettings(extras);
    if (await addProduct(newImages, { options: clean.options, madeToOrderDays: clean.madeToOrderDays, notePrompt: clean.notePrompt })) {
      setNewImages([]);
      setExtras(emptyExtras);
      setMore(false);
    }
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
        <button type="button" className="link-btn add-more" aria-expanded={more} onClick={() => setMore(v => !v)}>
          {more ? 'Hide sizes, colours and made to order' : '+ Sizes, lengths, colours, or made to order'}
        </button>
        {more && <OptionsEditor value={extras} onChange={setExtras} sym={sym} basePrice={Number(s.newPrice) || 0} />}
        {addError && <div className="form-error" role="alert">{addError}</div>}
      </form>
      {products.length === 0 && <div className="empty">No products yet. Add your first one above.</div>}
      <div className="list">
        {products.map((p, i) => (
          <ProductRow key={p.id ?? i + p.name} product={p} cost={costOf(p, i)} fmt={fmt} sym={sym} onSaveCost={c => setProductCost(i, c)} onSaveImages={imgs => setProductImages(i, imgs)} onEdit={() => setEditing(i)} />
        ))}
      </div>
      {editing !== null && products[editing] && (
        <EditProductSheet index={editing} product={products[editing]} cost={costOf(products[editing], editing)} sym={sym} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function ProductRow({ product: p, cost, fmt, sym, onSaveCost, onSaveImages, onEdit }: {
  product: Product;
  cost: number | null;
  fmt: (n: number) => string;
  sym: string;
  onSaveCost: (cost: number | null) => Promise<void>;
  onSaveImages: (images: string[]) => Promise<string>;
  onEdit: () => void;
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
        <div style={{ color: p.stock === 0 && !p.madeToOrderDays ? 'var(--alert)' : 'var(--muted)' }}>
          {p.madeToOrderDays ? `Made to order · ${p.madeToOrderDays} days` : p.stock === 0 ? 'Sold out' : p.stock + ' in stock'}
        </div>
        {!!p.options?.groups.length && (
          <div className="prod-opts">{p.options.groups.map(g => `${g.name}: ${g.choices.map(c => c.label).join(', ')}`).join(' · ')}</div>
        )}
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
      <div className="amount">{variesInPrice(p.price, p.options) ? 'From ' : ''}{fmt(fromPrice(p.price, p.options))}</div>
      <div className="prod-photos-link">
        <button type="button" className="link-btn" onClick={() => setPhotos(v => !v)}>
          {photos ? 'Done' : images.length ? `Photos (${images.length})` : 'Add photos'}
        </button>
        <button type="button" className="btn-sm pickup-edit prod-edit-btn" onClick={onEdit} aria-label={`Edit ${p.name}`}>Edit</button>
      </div>
      {photos && <div className="prod-photos"><PhotoStrip images={images} onChange={onSaveImages} /></div>}
    </div>
  );
}

/** Edit a product: name, price, stock, description, cost and photos. Also "sold out" and delete. */
function EditProductSheet({ index, product: p, cost, sym, onClose }: {
  index: number;
  product: Product;
  cost: number | null;
  sym: string;
  onClose: () => void;
}) {
  const { editProduct, deleteProduct, setProductImages } = useStore();
  const [name, setName] = useState(p.name);
  const [price, setPrice] = useState(String(p.price));
  const [stock, setStock] = useState(String(p.stock));
  const [description, setDescription] = useState(p.description ?? '');
  const [costValue, setCostValue] = useState(cost == null ? '' : String(cost));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [extras, setExtras] = useState<OptionSettings>({ options: p.options ?? null, madeToOrderDays: p.madeToOrderDays ?? null, notePrompt: p.notePrompt ?? '' });
  const perChoice = !!extras.options?.stock_per_choice;
  const digits = (v: string) => v.replace(/[^0-9]/g, '');

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return setError('Add a product name.');
    const clean = cleanSettings(extras);
    const problem = optionsProblem(clean);
    if (problem) return setError(problem);
    setBusy(true);
    setError('');
    const msg = await editProduct(index, {
      name,
      price: Number(price) || 0,
      // With stock per choice, the server adds the choices up.
      ...(clean.options?.stock_per_choice ? {} : { stock: Number(stock) || 0 }),
      description,
      cost: costValue.trim() === '' ? null : Number(costValue),
      options: clean.options,
      madeToOrderDays: clean.madeToOrderDays,
      notePrompt: clean.notePrompt,
    });
    setBusy(false);
    if (msg) setError(msg);
    else onClose();
  };

  const remove = async () => {
    setBusy(true);
    const msg = await deleteProduct(index);
    setBusy(false);
    if (msg) setError(msg);
    else onClose();
  };

  return (
    <div className="sheet-overlay vf-overlay" role="dialog" aria-modal="true" aria-labelledby="pe-title">
      <form className="vf-card" onSubmit={save}>
        <div className="vf-head">
          <h2 id="pe-title">Edit product</h2>
          <button type="button" className="vf-x" aria-label="Close" onClick={onClose}>×</button>
        </div>
        {confirmDelete ? (
          <>
            <p className="vf-why">Delete <b>{p.name}</b>? It disappears from your store and AQUENORA search straight away. Orders you've already had for it stay in Orders and Financials.</p>
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="vf-actions">
              <button type="button" className="btn-sm pickup-edit" onClick={() => setConfirmDelete(false)} disabled={busy}>Keep it</button>
              <button type="button" className="btn-dark pe-danger" onClick={remove} disabled={busy}>{busy ? 'Deleting…' : 'Yes, delete'}</button>
            </div>
          </>
        ) : (
          <>
            <label className="ob-label">Product name
              <input className="field ob-input" value={name} maxLength={120} onChange={e => setName(e.target.value)} />
            </label>
            <div className="vf-two">
              <label className="ob-label">Price ({sym})
                <input className="field ob-input" inputMode="numeric" value={price} onChange={e => setPrice(digits(e.target.value))} />
              </label>
              <label className="ob-label">In stock
                {perChoice || extras.madeToOrderDays
                  ? <input className="field ob-input" disabled value={perChoice ? 'per choice ↓' : 'made to order'} />
                  : <input className="field ob-input" inputMode="numeric" value={stock} onChange={e => setStock(digits(e.target.value))} />}
              </label>
            </div>
            {Number(stock) > 0 && !perChoice && !extras.madeToOrderDays && (
              <button type="button" className="link-btn pe-soldout" onClick={() => setStock('0')}>Mark as sold out</button>
            )}
            <label className="ob-label"><span>Description <span className="pe-opt">(optional)</span></span>
              <textarea className="field ob-input pe-desc" rows={4} maxLength={2000} value={description}
                placeholder="Size, material, how it fits, delivery time…" onChange={e => setDescription(e.target.value)} />
            </label>
            <label className="ob-label"><span>Cost price ({sym}) <span className="pe-opt">(optional, only you see it)</span></span>
              <input className="field ob-input" inputMode="numeric" value={costValue} placeholder="What one costs you" onChange={e => setCostValue(digits(e.target.value))} />
            </label>
            <OptionsEditor value={extras} onChange={setExtras} sym={sym} basePrice={Number(price) || 0} />
            <PhotoStrip images={p.images ?? []} onChange={imgs => setProductImages(index, imgs)} />
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="vf-actions pe-actions">
              <button type="button" className="link-btn pe-delete" onClick={() => setConfirmDelete(true)} disabled={busy}>Delete product</button>
              <span className="pe-spacer" />
              <button type="button" className="btn-sm pickup-edit" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="btn-dark" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
