import { useRef, useState } from 'react';
import { useStore } from '../store';
import { ImageCropper } from './ImageCropper';

export const MAX_PRODUCT_PHOTOS = 5;

/**
 * A product's photos: add (with crop/zoom/rotate), remove, and reorder.
 * The first photo is the main one shown on the store.
 */
export function PhotoStrip({ images, onChange, busy: outerBusy = false, label = 'Product photos' }: {
  images: string[];
  /** Called with the new list; may save to the server. Return an error message, or '' when fine. */
  onChange: (images: string[]) => Promise<string> | string;
  busy?: boolean;
  label?: string;
}) {
  const { uploadPhoto } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const full = images.length >= MAX_PRODUCT_PHOTOS;
  const working = busy || outerBusy;

  const apply = async (next: string[]) => {
    setBusy(true);
    setError('');
    const err = await onChange(next);
    if (err) setError(err);
    setBusy(false);
  };

  const add = async (file: File) => {
    setCropping(null);
    setBusy(true);
    setError('');
    try {
      const url = await uploadPhoto('product', file);
      const err = await onChange([...images, url]);
      if (err) setError(err);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the photo. Please try again.');
    }
    setBusy(false);
  };

  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    apply(next);
  };

  return (
    <div className="photos">
      <div className="photos-label">{label} <span>{images.length}/{MAX_PRODUCT_PHOTOS}</span></div>
      <div className="photos-row">
        {images.map((url, i) => (
          <div key={url} className="photo-tile">
            <img src={url} alt={i === 0 ? 'Main photo' : `Photo ${i + 1}`} />
            {i === 0 && <span className="photo-main">Main</span>}
            <button type="button" className="photo-x" aria-label={`Remove photo ${i + 1}`} disabled={working} onClick={() => apply(images.filter((_, k) => k !== i))}>×</button>
            {images.length > 1 && (
              <div className="photo-move">
                <button type="button" aria-label={`Move photo ${i + 1} left`} disabled={working || i === 0} onClick={() => move(i, -1)}>‹</button>
                {i !== 0 && <button type="button" className="photo-star" aria-label={`Make photo ${i + 1} the main photo`} disabled={working} onClick={() => apply([url, ...images.filter((_, k) => k !== i)])}>★</button>}
                <button type="button" aria-label={`Move photo ${i + 1} right`} disabled={working || i === images.length - 1} onClick={() => move(i, 1)}>›</button>
              </div>
            )}
          </div>
        ))}
        {!full && (
          <button type="button" className="photo-add" disabled={working} onClick={() => input.current?.click()}>
            <span>{busy ? '…' : '+'}</span>
            {busy ? 'Saving' : images.length ? 'Add photo' : 'Add photos'}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Choose a product photo"
        onChange={e => { const f = e.target.files?.[0]; if (input.current) input.current.value = ''; if (f) setCropping(f); }} />
      {error ? <div className="form-error" role="alert">{error}</div> : images.length > 1 ? <div className="ctl-note">★ makes a photo the main one. ‹ › change the order.</div> : null}
      {cropping && <ImageCropper file={cropping} kind="product" onCancel={() => setCropping(null)} onDone={add} />}
    </div>
  );
}
