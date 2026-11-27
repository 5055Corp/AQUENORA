import { useRef, useState } from 'react';
import { useStore } from '../store';
import { checkRows, MAX_IMPORT, TEMPLATE, type CheckedRow } from '../productCsv';

/** Saves the template: the share sheet on phones (Save to Files, WhatsApp, email), a download elsewhere. */
async function saveTemplate() {
  const file = new File([TEMPLATE], 'AQUENORA products.csv', { type: 'text/csv' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'AQUENORA products template' });
      return;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "Add many at once": fill in a spreadsheet, check it here, then add every product in one go. */
export function ImportProducts({ onClose }: { onClose: () => void }) {
  const { importProducts, fmt } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<CheckedRow[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ created: number; failed: { row: number; title: string; message: string }[] } | null>(null);
  const good = rows.filter(r => r.product);
  const bad = rows.filter(r => !r.product);

  const read = async (f: File | undefined) => {
    if (!f) return;
    setDone(null);
    setFileName(f.name);
    if (/\.(xlsx|xls|numbers)$/i.test(f.name)) {
      setRows([]);
      return setError('Save the spreadsheet as CSV first (File → Download or Export → CSV), then choose that file.');
    }
    if (f.size > 1_000_000) {
      setRows([]);
      return setError('That file is too big. Up to 200 products at a time.');
    }
    const res = checkRows(await f.text());
    setRows(res.rows);
    setError(res.error);
  };

  const add = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await importProducts(good.map(r => r.product!));
      // The server numbers the rows it was sent; show the spreadsheet's own line numbers.
      setDone({ ...res, failed: res.failed.map(f => ({ ...f, row: good[f.row - 1]?.line ?? f.row })) });
      setRows([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add them. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet-overlay vf-overlay" role="dialog" aria-modal="true" aria-label="Add many products" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vf-card imp-sheet">
        <div className="vf-head">
          <h2>Add many products</h2>
          <button type="button" className="vf-x" aria-label="Close" onClick={onClose}>×</button>
        </div>

        {done ? (
          <div className="imp-done">
            <div className="imp-big">✓ {done.created} {done.created === 1 ? 'product' : 'products'} added</div>
            {done.failed.length > 0 && (
              <div className="imp-errors">
                <b>{done.failed.length} couldn't be added:</b>
                {done.failed.map(f => <div key={f.row}>Row {f.row} · {f.title}: {f.message}</div>)}
              </div>
            )}
            <p className="ctl-note">Next: tap <b>Add photos</b> on each product. Photos can't go in the spreadsheet.</p>
            <button type="button" className="btn-dark" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <ol className="imp-steps">
              <li>
                <b>Get the template</b>
                <span>A spreadsheet with the columns filled in for 3 example products.</span>
                <button type="button" className="btn-sm pickup-edit" onClick={saveTemplate}>Download template</button>
              </li>
              <li>
                <b>Fill it in</b>
                <span>One product per row, in Excel, Google Sheets or Numbers. Delete the examples. Sizes or colours go in <i>Option 1 choices</i>, split by <b>|</b> (e.g. <code>S | M | L</code>). Up to {MAX_IMPORT} products.</span>
              </li>
              <li>
                <b>Save as CSV and choose it here</b>
                <input ref={input} type="file" accept=".csv,text/csv,text/plain" hidden onChange={e => { read(e.target.files?.[0]); e.target.value = ''; }} />
                <button type="button" className="btn-sm pickup-edit" onClick={() => input.current?.click()}>{fileName ? 'Choose another file' : 'Choose CSV file'}</button>
                {fileName && <span className="imp-file">{fileName}</span>}
              </li>
            </ol>

            {error && <div className="form-error" role="alert">{error}</div>}

            {rows.length > 0 && (
              <>
                <div className="imp-summary">
                  <span className="imp-ok">{good.length} ready</span>
                  {bad.length > 0 && <span className="imp-bad">{bad.length} need fixing</span>}
                </div>
                <div className="imp-list">
                  {rows.map(r => (
                    <div key={r.line} className={'imp-row' + (r.product ? '' : ' imp-row-bad')}>
                      <span className="imp-line">{r.line}</span>
                      {r.product ? (
                        <span className="imp-what">
                          <b>{r.product.title}</b> · {fmt(r.product.price)}
                          {r.product.made_to_order_days ? ` · made in ${r.product.made_to_order_days} days` : r.product.stock !== undefined ? ` · ${r.product.stock} in stock` : ''}
                          {r.product.options && <small>{r.product.options.groups.map(g => `${g.name}: ${g.choices.map(c => c.label).join(', ')}`).join(' · ')}</small>}
                        </span>
                      ) : (
                        <span className="imp-what">Row {r.line}: {r.error}</span>
                      )}
                    </div>
                  ))}
                </div>
                {bad.length > 0 && <p className="ctl-note">Rows that need fixing are skipped. Fix them in the spreadsheet and add them later, or add the {good.length} ready ones now.</p>}
                <button type="button" className="btn-dark imp-add" disabled={busy || !good.length} onClick={add}>
                  {busy ? `Adding ${good.length} products…` : `Add ${good.length} ${good.length === 1 ? 'product' : 'products'}`}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
