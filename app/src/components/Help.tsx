import { useStore } from '../store';

/** "What does this mean?" link plus an inline explanation, so sellers never have to leave for a help centre. */
export function Help({ id, text }: { id: string; text: string }) {
  const { s, showHints, toggleHelp } = useStore();
  if (!showHints) return null;
  const open = !!s.help[id];
  return (
    <>
      <button type="button" className="link-btn" aria-expanded={open} onClick={() => toggleHelp(id)}>
        {open ? 'Hide explanation' : 'What does this mean?'}
      </button>
      {open && <div className="help-box">{text}</div>}
    </>
  );
}
