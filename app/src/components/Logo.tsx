import { useId, type CSSProperties } from 'react';
import { WORDMARK_CAP, WORDMARK_PATH, WORDMARK_WIDTH } from '../brandWordmark';

// The AQUENORA symbol: an A with a star of light at its peak and an orbit ring as its crossbar.
// Drawn in the current text colour, so it suits any background (a seller's store colours too).
// The ring's back half passes behind the A and its front half in front; the A is cut away
// where the front crosses it, so the gap is see-through on any background.

const CX = 256, CY = 320, RX = 196, RY = 50, ROT = -12;
const BACK = `M${CX - RX} ${CY} A${RX} ${RY} 0 0 1 ${CX + RX} ${CY}`;
const FRONT = `M${CX + RX} ${CY} A${RX} ${RY} 0 0 1 ${CX - RX} ${CY}`;
const LEFT = 'M100 424 L146 424 L248 160 L222 160 Z';
const RIGHT = 'M412 424 L366 424 L264 160 L290 160 Z';
const STAR = 'M256 68 L263.2 96.8 L292 104 L263.2 111.2 L256 140 L248.8 111.2 L220 104 L248.8 96.8 Z';

export function Mark({ size = '1em', ringColor, title, style }: { size?: string | number; ringColor?: string; title?: string; style?: CSSProperties }) {
  const id = useId().replace(/:/g, '');
  const ring = ringColor ?? 'currentColor';
  const ringOpacity = ringColor ? 1 : 0.62;
  return (
    <svg viewBox="40 52 432 400" width={size} height={size} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ display: 'block', flexShrink: 0, ...style }}>
      {title && <title>{title}</title>}
      <defs>
        <mask id={`${id}-gap`} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <rect width="512" height="512" fill="#fff" />
          <path d={FRONT} transform={`rotate(${ROT} ${CX} ${CY})`} fill="none" stroke="#000" strokeWidth="25" strokeLinecap="round" />
        </mask>
      </defs>
      <path d={BACK} transform={`rotate(${ROT} ${CX} ${CY})`} fill="none" stroke={ring} strokeOpacity={ringOpacity} strokeWidth="11" strokeLinecap="round" />
      <g mask={`url(#${id}-gap)`} fill="currentColor">
        <path d={LEFT} />
        <path d={RIGHT} />
      </g>
      <path d={FRONT} transform={`rotate(${ROT} ${CX} ${CY})`} fill="none" stroke={ring} strokeOpacity={ringOpacity} strokeWidth="11" strokeLinecap="round" />
      <path d={STAR} fill="currentColor" />
    </svg>
  );
}

/** The name alone, as outlines, in the current text colour. `height` is the capital height. */
export function Wordmark({ height = '0.72em' }: { height?: string | number }) {
  return (
    <svg viewBox={`0 ${-WORDMARK_CAP} ${WORDMARK_WIDTH} ${WORDMARK_CAP}`} height={height} aria-hidden="true" style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}>
      <path d={WORDMARK_PATH} fill="currentColor" />
    </svg>
  );
}

/** Symbol + name. Sized by the font size of where it's placed (e.g. the .wordmark class). */
export function Logo({ className = 'wordmark', ringColor, style }: { className?: string; ringColor?: string; style?: CSSProperties }) {
  return (
    <div className={`logo ${className}`} role="img" aria-label="AQUENORA" style={style}>
      <Mark size="1.9em" ringColor={ringColor} />
      <Wordmark />
    </div>
  );
}
