import { useState } from 'react';
import type { StoreCollection } from '../api';
import { useStore } from '../store';

const slug = (name: string, taken: Set<string>) => {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'collection';
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
};

/** Products → Collections: "Wigs", "Bundles"... Buyers see them as tabs on the store. */
export function CollectionsCard() {
  const { s, setCollections, products, flash } = useStore();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const list = s.collections;
  const count = (id: string) => products.filter(p => p.collections?.includes(id)).length;
  const save = async (next: StoreCollection[], done: string) => {
    const msg = await setCollections(next);
    if (msg) setError(msg);
    else { setError(''); flash(done); }
  };
  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (list.some(c => c.name.toLowerCase() === n.toLowerCase())) return setError('You already have that collection.');
    if (list.length >= 20) return setError('A store can have up to 20 collections.');
    save([...list, { id: slug(n, new Set(list.map(c => c.id))), name: n }], `${n} added`);
    setName('');
  };
  const move = (i: number, by: number) => {
    const next = [...list];
    const [c] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(next.length, i + by)), 0, c);
    save(next, 'Order saved');
  };
  return (
    <section className="card coll" aria-labelledby="coll-title">
      <div className="coll-head">
        <h2 id="coll-title" className="card-title">Collections</h2>
        <span className="coll-note">Shown as tabs on your store</span>
      </div>
      {list.length === 0 && <p className="coll-empty">Group products like "Wigs", "Bundles" or "New in". Then tick them on each product (Edit).</p>}
      <ul className="coll-list">
        {list.map((c, i) => (
          <li key={c.id}>
            <span><b>{c.name}</b> <small>{count(c.id)} {count(c.id) === 1 ? 'product' : 'products'}</small></span>
            <span className="coll-btns">
              <button type="button" aria-label={`Move ${c.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button type="button" aria-label={`Move ${c.name} down`} disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button type="button" aria-label={`Delete ${c.name}`} onClick={() => save(list.filter(x => x.id !== c.id), `${c.name} deleted`)}>×</button>
            </span>
          </li>
        ))}
      </ul>
      <form className="coll-add" onSubmit={e => { e.preventDefault(); add(); }}>
        <input className="field" placeholder="New collection, e.g. Wigs" maxLength={30} value={name} onChange={e => setName(e.target.value)} aria-label="New collection name" />
        <button type="submit" className="btn-dark btn-sm">Add</button>
      </form>
      {error && <div className="form-error" role="alert">{error}</div>}
    </section>
  );
}

/** In Edit product: tick the collections this product is in. */
export function CollectionPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { s } = useStore();
  if (!s.collections.length) return null;
  return (
    <div className="coll-pick">
      <div className="ctl-label">Collections</div>
      <div className="coll-chips">
        {s.collections.map(c => {
          const on = value.includes(c.id);
          return (
            <button key={c.id} type="button" aria-pressed={on} className={'coll-chip' + (on ? ' on' : '')}
              onClick={() => onChange(on ? value.filter(x => x !== c.id) : [...value, c.id])}>{on ? '✓ ' : ''}{c.name}</button>
          );
        })}
      </div>
    </div>
  );
}
