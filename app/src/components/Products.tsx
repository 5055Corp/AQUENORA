import type { FormEvent } from 'react';
import { useStore } from '../store';

export function Products() {
  const { s, set, flash, products, fmt, country, h1Size } = useStore();

  const add = (e?: FormEvent) => {
    e?.preventDefault();
    if (!s.newName.trim()) return;
    set({ products: [{ name: s.newName.trim(), price: Number(s.newPrice) || 0, stock: 1 }, ...products], newName: '', newPrice: '' });
    flash('Product added to your store');
  };

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
            placeholder={'Price (' + country.sym.trim() + ')'}
            inputMode="numeric"
            value={s.newPrice}
            onChange={e => set({ newPrice: e.target.value.replace(/[^0-9]/g, '') })}
          />
          <button type="submit" className="btn-dark">Add</button>
        </div>
      </form>
      <div className="list">
        {products.map((p, i) => (
          <div key={i + p.name} className="card prod">
            <div className="prod-thumb" />
            <div className="prod-info">
              <div>{p.name}</div>
              <div style={{ color: p.stock === 0 ? 'var(--alert)' : 'var(--muted)' }}>
                {p.stock === 0 ? 'Sold out' : p.stock + ' in stock'}
              </div>
            </div>
            <div className="amount">{fmt(p.price)}</div>
          </div>
        ))}
      </div>
    </>
  );
}
