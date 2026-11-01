// The prototype's "Tweaks" panel, exposed as URL query parameters:
//   ?screen=onboarding|dashboard|theme-editor
//   &device=auto|mobile|desktop
//   &hints=on|off

export interface Settings {
  startScreen: 'onboarding' | 'dashboard' | 'theme-editor';
  device: 'auto' | 'mobile' | 'desktop';
  showHelpHints: boolean;
}

function pick<T extends string>(value: string | null, options: readonly T[], fallback: T): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

export function readSettings(search = window.location.search): Settings {
  const q = new URLSearchParams(search);
  return {
    startScreen: pick(q.get('screen'), ['onboarding', 'dashboard', 'theme-editor'] as const, 'onboarding'),
    device: pick(q.get('device'), ['auto', 'mobile', 'desktop'] as const, 'auto'),
    showHelpHints: !['off', 'false', '0'].includes((q.get('hints') ?? '').toLowerCase()),
  };
}
