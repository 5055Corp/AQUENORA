import { useEffect, useMemo, useRef, useState } from 'react';
import type { ImageKind } from '../images';

/** Frame shapes the seller can pick. null = the photo's own shape. */
const SHAPES: Record<ImageKind, { id: string; label: string; ratio: number | null }[]> = {
  logo: [
    { id: 'original', label: 'Original', ratio: null },
    { id: 'square', label: 'Square', ratio: 1 },
    { id: 'wide', label: 'Wide', ratio: 3 },
  ],
  banner: [
    { id: 'wide', label: 'Banner', ratio: 2.4 },
    { id: 'original', label: 'Original', ratio: null },
  ],
  product: [
    { id: 'square', label: 'Square', ratio: 1 },
    { id: 'portrait', label: 'Portrait', ratio: 0.8 },
    { id: 'original', label: 'Original', ratio: null },
  ],
};

/** Largest size we export; the upload step shrinks and compresses it further. */
const OUT_MAX = 2400;
const MAX_ZOOM = 4;

/**
 * Crop, zoom, move and rotate a photo before it's uploaded.
 * Drag the photo to move it, use the slider (or pinch on a phone) to zoom.
 */
export function ImageCropper({ file, kind, onCancel, onDone }: {
  file: File;
  kind: ImageKind;
  onCancel: () => void;
  onDone: (cropped: File) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState('');
  const [shapeId, setShapeId] = useState(SHAPES[kind][0].id);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0); // 0, 90, 180, 270
  const [off, setOff] = useState({ x: 0, y: 0 }); // photo centre offset, in frame pixels
  const [frameW, setFrameW] = useState(320);
  const frameRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    let live = true;
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { if (live) setImg(im); };
    im.onerror = () => { if (live) setError("That file isn't a picture we can open. Try a JPG or PNG photo."); };
    im.src = url;
    return () => { live = false; URL.revokeObjectURL(url); };
  }, [file]);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFrameW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  // Size of the photo once rotated.
  const turned = rot % 180 !== 0;
  const iw = img ? (turned ? img.naturalHeight : img.naturalWidth) : 1;
  const ih = img ? (turned ? img.naturalWidth : img.naturalHeight) : 1;
  const ratio = SHAPES[kind].find(s => s.id === shapeId)?.ratio ?? iw / ih;
  const frameH = frameW / ratio;
  // At zoom 1 the photo just covers the frame.
  const base = Math.max(frameW / iw, frameH / ih);
  const scale = base * zoom;
  const dispW = iw * scale;
  const dispH = ih * scale;

  /** Keeps the photo covering the whole frame. */
  const clamp = useMemo(() => (o: { x: number; y: number }) => {
    const mx = Math.max(0, (dispW - frameW) / 2);
    const my = Math.max(0, (dispH - frameH) / 2);
    return { x: Math.min(mx, Math.max(-mx, o.x)), y: Math.min(my, Math.max(-my, o.y)) };
  }, [dispW, dispH, frameW, frameH]);

  // Always show (and save) a position where the photo covers the frame.
  const pos = clamp(off);
  const reset = () => { setZoom(1); setOff({ x: 0, y: 0 }); };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(Math.min(MAX_ZOOM, Math.max(1, pinch.current.zoom * (d / pinch.current.dist))));
    } else if (pointers.current.size === 1) {
      setOff(o => { const c = clamp(o); return clamp({ x: c.x + now.x - prev.x, y: c.y + now.y - prev.y }); });
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const save = () => {
    if (!img) return;
    // The frame's area in rotated-photo pixels.
    const cw = frameW / scale;
    const ch = frameH / scale;
    const cx = iw / 2 - pos.x / scale;
    const cy = ih / 2 - pos.y / scale;
    const out = Math.min(1, OUT_MAX / Math.max(cw, ch));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(cw * out));
    canvas.height = Math.max(1, Math.round(ch * out));
    const ctx = canvas.getContext('2d');
    if (!ctx) { setError('Your phone could not process the picture.'); return; }
    ctx.imageSmoothingQuality = 'high';
    ctx.scale(out, out);
    ctx.translate(-(cx - cw / 2), -(cy - ch / 2));
    // Draw the photo rotated, in rotated-photo coordinates.
    ctx.translate(iw / 2, ih / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const type = kind === 'logo' ? 'image/png' : 'image/jpeg';
    const fileName = kind === 'logo' ? 'logo.png' : `${kind}.jpg`;
    canvas.toBlob(blob => {
      if (!blob) { setError('Your phone could not process the picture.'); return; }
      onDone(new File([blob], fileName, { type }));
    }, type, 0.92);
  };

  return (
    <div className="sheet-overlay crop-overlay" role="dialog" aria-modal="true" aria-labelledby="crop-title">
      <div className="crop-card">
        <h2 id="crop-title">{kind === 'logo' ? 'Adjust your logo' : kind === 'banner' ? 'Adjust your banner photo' : 'Adjust your product photo'}</h2>
        {error ? (
          <p className="form-error" role="alert">{error}</p>
        ) : !img ? (
          <p>Opening your photo…</p>
        ) : (
          <>
            <div className="seg seg-wide" role="group" aria-label="Shape">
              {SHAPES[kind].map(s => (
                <button key={s.id} type="button" aria-pressed={shapeId === s.id} style={{ background: shapeId === s.id ? '#fff' : 'transparent' }} onClick={() => { setShapeId(s.id); reset(); }}>{s.label}</button>
              ))}
            </div>
            <div
              ref={frameRef}
              className={'crop-frame' + (kind === 'logo' ? ' crop-frame-logo' : '')}
              style={{ height: frameH }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img
                src={img.src}
                alt=""
                draggable={false}
                style={{
                  width: img.naturalWidth * scale,
                  height: img.naturalHeight * scale,
                  transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${rot}deg)`,
                }}
              />
            </div>
            <p className="ctl-note">Drag to move the photo. Pinch or use the slider to zoom.</p>
            <div className="crop-tools">
              <label className="crop-zoom">
                <span>Zoom</span>
                <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={e => setZoom(Number(e.target.value))} />
              </label>
              <button type="button" className="btn-sm pickup-edit" onClick={() => { setRot(r => (r + 90) % 360); reset(); }}>Rotate ↻</button>
            </div>
          </>
        )}
        <div className="del-btns">
          <button type="button" className="btn-sm pickup-edit" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn-dark btn-sm" disabled={!img} onClick={save}>Use photo</button>
        </div>
      </div>
    </div>
  );
}
