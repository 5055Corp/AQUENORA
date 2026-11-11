// Store logo and banner photos: shrunk in the seller's browser before upload, so stores load
// fast on mobile data and uploads work on slow connections.

export type ImageKind = 'logo' | 'banner';

/** Longest side in pixels. Logos are shown small; banners fill a wide strip. */
const MAX: Record<ImageKind, { w: number; h: number }> = { logo: { w: 400, h: 400 }, banner: { w: 1800, h: 1000 } };

export interface PreparedImage {
  mimeType: 'image/webp' | 'image/jpeg' | 'image/png';
  /** base64, no "data:" prefix. */
  base64: string;
  dataUrl: string;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file isn't a picture we can open. Try a JPG or PNG photo.")); };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(r => canvas.toBlob(r, type, quality));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('Could not read the picture.'));
    fr.readAsDataURL(blob);
  });
}

/** Resizes and compresses a photo. WebP where the browser can make it; else PNG (logos) or JPEG. */
export async function prepareImage(file: File, kind: ImageKind): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a picture (JPG, PNG or WebP).');
  if (file.size > 25 * 1024 * 1024) throw new Error('That picture is very large. Choose one under 25 MB.');
  const img = await loadImage(file);
  const { w, h } = MAX[kind];
  const scale = Math.min(1, w / img.naturalWidth, h / img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process the picture.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let blob = await toBlob(canvas, 'image/webp', 0.82);
  if (!blob || blob.type !== 'image/webp') {
    // Older Safari can't make WebP: keep logos' transparency with PNG, photos as JPEG.
    blob = await toBlob(canvas, kind === 'logo' ? 'image/png' : 'image/jpeg', 0.85);
  }
  if (!blob) throw new Error('Your browser could not process the picture.');
  if (blob.size > 2 * 1024 * 1024) throw new Error('That picture is still too big after shrinking. Try another one.');
  const dataUrl = await blobToDataUrl(blob);
  return { mimeType: blob.type as PreparedImage['mimeType'], base64: dataUrl.slice(dataUrl.indexOf(',') + 1), dataUrl };
}

/** Image addresses we accept in a design: uploaded (http/https) or, in the demo, kept in the browser. */
export const isImageUrl = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 3_000_000 &&
  (/^https?:\/\/[^\s"'<>()]+$/.test(v) && v.length <= 500 || /^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(v));
