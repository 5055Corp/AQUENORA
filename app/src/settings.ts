// The prototype's "Tweaks" panel, exposed as URL query parameters:
//   ?screen=onboarding|dashboard|theme-editor
//   &device=auto|mobile|desktop
//   &hints=on|off
//   &reset=1   (clears the saved demo store, e.g. between seller interviews)

export interface Settings {
  startScreen: 'onboarding' | 'dashboard' | 'theme-editor';
  /** True when ?screen= was given; it then wins over the screen saved from last time. */
  screenFromUrl: boolean;
  device: 'auto' | 'mobile' | 'desktop';
  showHelpHints: boolean;
  reset: boolean;
}

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

export function readSettings(search = window.location.search): Settings {
  const q = new URLSearchParams(search);
  const screens = ['onboarding', 'dashboard', 'theme-editor'] as const;
  return {
    startScreen: pick(q.get('screen'), screens, 'onboarding'),
    screenFromUrl: screens.includes(q.get('screen') as (typeof screens)[number]),
    device: pick(q.get('device'), ['auto', 'mobile', 'desktop'] as const, 'auto'),
    showHelpHints: !['off', 'false', '0'].includes((q.get('hints') ?? '').toLowerCase()),
    reset: q.has('reset'),
  };
}
