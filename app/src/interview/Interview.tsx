import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { LIVE, submitInterview } from '../api';
import { TAGLINE } from '../brand';
import { ALL_QUESTIONS, CURRENCY, SECTIONS, VERSION, type Answer, type Answers, type Question } from './questions';

const DRAFT_KEY = 'aquenora-interview-draft';
const SCALE_IDS = ['must', 'nice', 'no'] as const;

interface Contact { name: string; phone: string; email: string; earlyAccess: boolean; contactOk: boolean; website: string }
const emptyContact: Contact = { name: '', phone: '', email: '', earlyAccess: false, contactOk: false, website: '' };

function loadDraft(): { answers: Answers; contact: Contact; step: number } {
  try {
    const v = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null');
    if (v && typeof v === 'object' && v.answers && typeof v.answers === 'object') {
      return { answers: v.answers, contact: { ...emptyContact, ...(v.contact ?? {}), website: '' }, step: Number(v.step) || 0 };
    }
  } catch {
    /* storage unavailable */
  }
  return { answers: {}, contact: emptyContact, step: 0 };
}

function saveDraft(v: { answers: Answers; contact: Contact; step: number }) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}

const visible = (q: Question, a: Answers) => !q.when || q.when(a);
const otherKey = (id: string) => `${id}__other`;

function isAnswered(q: Question, a: Answers): boolean {
  const v = a[q.id];
  if (q.kind === 'rate') return !!v && typeof v === 'object' && !Array.isArray(v) && q.items.every(i => (v as Record<string, string>)[i]);
  if (Array.isArray(v)) return v.length > 0 && (!v.includes('Other') || !!String(a[otherKey(q.id)] ?? '').trim());
  if (typeof v === 'string') return v.trim() !== '' && (v !== 'Other' || !!String(a[otherKey(q.id)] ?? '').trim());
  return false;
}

/** Turns the answers into what's saved: each question's wording beside the answer. */
function toPayload(a: Answers) {
  const symbol = CURRENCY[String(a.country ?? '')] ?? '';
  const out: { id: string; section: string; question: string; answer: string | string[] }[] = [];
  for (const q of ALL_QUESTIONS) {
    if (!visible(q, a)) continue;
    const v = a[q.id];
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) continue;
    const other = String(a[otherKey(q.id)] ?? '').trim();
    const withOther = (x: string) => (x === 'Other' && other ? `Other: ${other}` : x);
    if (q.kind === 'single') out.push({ id: q.id, section: q.section, question: q.q, answer: [withOther(String(v))] });
    else if (q.kind === 'multi') out.push({ id: q.id, section: q.section, question: q.q, answer: (v as string[]).map(withOther) });
    else if (q.kind === 'money') out.push({ id: q.id, section: q.section, question: q.q, answer: `${symbol} ${String(v).trim()}`.trim() });
    else if (q.kind === 'rate') {
      const r = v as Record<string, string>;
      q.scale.forEach((label, i) => {
        out.push({ id: `${q.id}_${SCALE_IDS[i]}`, section: q.section, question: `${q.q} (${label})`, answer: q.items.filter(item => r[item] === label) });
      });
    } else out.push({ id: q.id, section: q.section, question: q.q, answer: String(v) });
  }
  return out;
}

function Choices({ q, a, set }: { q: Extract<Question, { kind: 'single' | 'multi' }>; a: Answers; set: (id: string, v: Answer) => void }) {
  const multi = q.kind === 'multi';
  const value = a[q.id];
  const picked = multi ? ((value as string[]) ?? []) : value ? [value as string] : [];
  const options = q.other ? [...q.options, 'Other'] : q.options;
  const full = multi && q.max ? picked.length >= q.max : false;
  const toggle = (opt: string) => {
    if (!multi) return set(q.id, opt);
    if (picked.includes(opt)) return set(q.id, picked.filter(x => x !== opt));
    if (!full) set(q.id, [...picked, opt]);
  };
  return (
    <>
      <div className="iv-choices" role={multi ? 'group' : 'radiogroup'} aria-labelledby={`${q.id}-label`}>
        {options.map(opt => {
          const on = picked.includes(opt);
          return (
            <button
              type="button"
              key={opt}
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={on}
              className="iv-choice"
              data-on={on}
              disabled={!on && full}
              onClick={() => toggle(opt)}
            >
              <span className="iv-mark" aria-hidden="true">{on ? '✓' : ''}</span>
              {opt}
            </button>
          );
        })}
      </div>
      {multi && q.max && <div className="iv-count">{picked.length} of {q.max} picked</div>}
      {picked.includes('Other') && (
        <input
          className="iv-input"
          aria-label={`${q.q} (other)`}
          placeholder="Please tell us"
          maxLength={200}
          value={String(a[otherKey(q.id)] ?? '')}
          onChange={e => set(otherKey(q.id), e.target.value)}
        />
      )}
    </>
  );
}

function Rate({ q, a, set }: { q: Extract<Question, { kind: 'rate' }>; a: Answers; set: (id: string, v: Answer) => void }) {
  const value = (a[q.id] as Record<string, string>) ?? {};
  return (
    <ul className="iv-rate">
      {q.items.map(item => (
        <li key={item}>
          <div className="iv-rate-item">{item}</div>
          <div className="iv-seg" role="radiogroup" aria-label={item}>
            {q.scale.map(label => (
              <button type="button" key={label} role="radio" aria-checked={value[item] === label} data-on={value[item] === label}
                onClick={() => set(q.id, { ...value, [item]: label })}>
                {label}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Field({ q, a, set, showError }: { q: Question; a: Answers; set: (id: string, v: Answer) => void; showError: boolean }) {
  const missing = showError && !q.optional && !isAnswered(q, a);
  const symbol = CURRENCY[String(a.country ?? '')] ?? '';
  return (
    <fieldset className="iv-q" data-missing={missing}>
      <legend id={`${q.id}-label`} className="iv-q-title">
        {q.q} {q.optional && <span className="iv-optional">Optional</span>}
      </legend>
      {q.help && <p className="iv-help">{q.help}</p>}
      {(q.kind === 'single' || q.kind === 'multi') && <Choices q={q} a={a} set={set} />}
      {q.kind === 'rate' && <Rate q={q} a={a} set={set} />}
      {q.kind === 'text' && (
        <input className="iv-input" aria-labelledby={`${q.id}-label`} placeholder={q.placeholder} maxLength={200}
          value={String(a[q.id] ?? '')} onChange={e => set(q.id, e.target.value)} />
      )}
      {q.kind === 'long' && (
        <textarea className="iv-input" aria-labelledby={`${q.id}-label`} rows={4} placeholder={q.placeholder} maxLength={3000}
          value={String(a[q.id] ?? '')} onChange={e => set(q.id, e.target.value)} />
      )}
      {q.kind === 'money' && (
        <div className="iv-money">
          {symbol && <span aria-hidden="true">{symbol}</span>}
          <input className="iv-input" aria-labelledby={`${q.id}-label`} inputMode="decimal" placeholder={symbol ? 'Amount' : 'Amount and currency'} maxLength={40}
            value={String(a[q.id] ?? '')} onChange={e => set(q.id, e.target.value)} />
        </div>
      )}
      {missing && <p className="iv-error" role="alert">Please answer this one.</p>}
    </fieldset>
  );
}

export function Interview() {
  const draft = useMemo(() => loadDraft(), []);
  const [answers, setAnswers] = useState<Answers>(draft.answers);
  const [contact, setContact] = useState<Contact>(draft.contact);
  // Steps: 0 = welcome, 1..n = sections, n+1 = contact, n+2 = thank you.
  const [step, setStep] = useState(Math.min(draft.step, SECTIONS.length + 1));
  const [showError, setShowError] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const top = useRef<HTMLDivElement>(null);
  const source = useMemo(() => new URLSearchParams(window.location.search).get('ref')?.slice(0, 60) ?? '', []);

  const contactStep = SECTIONS.length + 1;
  const doneStep = SECTIONS.length + 2;

  useEffect(() => {
    if (step < doneStep) saveDraft({ answers, contact, step });
  }, [answers, contact, step, doneStep]);
  useEffect(() => {
    document.title = 'AQUENORA seller interview';
  }, []);

  const set = (id: string, v: Answer) => setAnswers(a => ({ ...a, [id]: v }));
  const go = (n: number) => {
    setStep(n);
    setShowError(false);
    window.requestAnimationFrame(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const section = step >= 1 && step <= SECTIONS.length ? SECTIONS[step - 1] : null;
  const next = () => {
    if (section) {
      const missing = section.questions.filter(q => visible(q, answers) && !q.optional && !isAnswered(q, answers));
      if (missing.length) {
        setShowError(true);
        window.requestAnimationFrame(() => document.querySelector('[data-missing="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        return;
      }
    }
    go(step + 1);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if ((contact.earlyAccess || contact.contactOk) && !contact.phone.trim() && !contact.email.trim()) {
      setSendError('Add your WhatsApp number or email so we can reach you, or untick the boxes.');
      return;
    }
    setSending(true);
    setSendError('');
    try {
      const country = answers.country === 'Other' ? String(answers[otherKey('country')] ?? '') : String(answers.country ?? '');
      if (LIVE) {
        await submitInterview({
          version: VERSION,
          answers: toPayload(answers),
          name: contact.name.trim() || undefined,
          phone: contact.phone.trim() || undefined,
          email: contact.email.trim() || undefined,
          contact_ok: contact.contactOk,
          wants_early_access: contact.earlyAccess,
          country: country || undefined,
          source: source || undefined,
          website: contact.website || undefined,
        });
      }
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* storage unavailable */
      }
      go(doneStep);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send your answers. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const shareUrl = `${window.location.origin}${window.location.pathname}`;
  const shareText = `I just shared my experience as a seller with AQUENORA. If you sell online, take their short interview too: ${shareUrl}`;
  const progress = Math.round((Math.min(step, contactStep) / contactStep) * 100);

  return (
    <div className="iv">
      <header className="iv-top" ref={top}>
        <div className="wordmark">AQUENORA</div>
        {step > 0 && step < doneStep && (
          <div className="iv-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
            <div style={{ width: `${progress}%` }} />
          </div>
        )}
      </header>

      <main className="iv-main">
        {step === 0 && (
          <section className="iv-welcome">
            <p className="iv-eyebrow">Seller interview · about 8 minutes</p>
            <h1>Help us build the online store African sellers actually need</h1>
            <p>
              We're building AQUENORA: an online store with payments straight to your bank, delivery at home and abroad, and tools to grow.
              Before we launch, we want to hear from real sellers. What works for you, what doesn't, and what would make your life easier.
            </p>
            <ul className="iv-points">
              <li>{SECTIONS.length} short parts. Most questions are tap-to-answer.</li>
              <li>Your answers are private and only used to build AQUENORA.</li>
              <li>At the end you can ask for free early access.</li>
            </ul>
            {!LIVE && <p className="iv-note">Preview: answers aren't saved on this copy.</p>}
            <button type="button" className="btn-dark iv-next" onClick={() => go(1)}>
              {Object.keys(draft.answers).length ? 'Continue where I left off' : 'Start'}
            </button>
            <p className="brand-line">{TAGLINE}</p>
          </section>
        )}

        {section && (
          <form className="iv-section" noValidate onSubmit={e => { e.preventDefault(); next(); }}>
            <p className="iv-eyebrow">Part {step} of {SECTIONS.length}</p>
            <h1>{section.title}</h1>
            <p className="iv-intro">{section.intro}</p>
            {section.questions.filter(q => visible(q, answers)).map(q => (
              <Field key={q.id} q={q} a={answers} set={set} showError={showError} />
            ))}
            {showError && section.questions.some(q => visible(q, answers) && !q.optional && !isAnswered(q, answers)) && (
              <p className="iv-error" role="alert">A few questions above still need an answer.</p>
            )}
            <div className="iv-nav">
              <button type="button" className="iv-back" onClick={() => go(step - 1)}>Back</button>
              <button type="submit" className="btn-dark iv-next">{step === SECTIONS.length ? 'Last step' : 'Next'}</button>
            </div>
          </form>
        )}

        {step === contactStep && (
          <form className="iv-section" noValidate onSubmit={submit}>
            <p className="iv-eyebrow">Last step</p>
            <h1>Stay in touch (optional)</h1>
            <p className="iv-intro">Leave your details if you'd like free early access, or if we may ask you a few follow-up questions. You can skip this.</p>
            <label className="iv-label">Your name
              <input className="iv-input" autoComplete="name" maxLength={100} value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))} />
            </label>
            <label className="iv-label">WhatsApp number
              <input className="iv-input" type="tel" autoComplete="tel" maxLength={30} placeholder="+234 801 234 5678" value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} />
            </label>
            <label className="iv-label">Email
              <input className="iv-input" type="email" autoComplete="email" maxLength={200} value={contact.email} onChange={e => setContact(c => ({ ...c, email: e.target.value }))} />
            </label>
            {/* Hidden from people; bots fill it in. */}
            <label className="iv-hp" aria-hidden="true">Website
              <input tabIndex={-1} autoComplete="off" value={contact.website} onChange={e => setContact(c => ({ ...c, website: e.target.value }))} />
            </label>
            <label className="iv-check">
              <input type="checkbox" checked={contact.earlyAccess} onChange={e => setContact(c => ({ ...c, earlyAccess: e.target.checked }))} />
              <span>Yes, give me free early access to AQUENORA</span>
            </label>
            <label className="iv-check">
              <input type="checkbox" checked={contact.contactOk} onChange={e => setContact(c => ({ ...c, contactOk: e.target.checked }))} />
              <span>You may contact me with a few follow-up questions</span>
            </label>
            <p className="iv-help">We only keep your contact details if you tick a box. We never share them.</p>
            {sendError && <p className="iv-error" role="alert">{sendError}</p>}
            <div className="iv-nav">
              <button type="button" className="iv-back" onClick={() => go(step - 1)}>Back</button>
              <button type="submit" className="btn-dark iv-next" disabled={sending}>{sending ? 'Sending…' : 'Send my answers'}</button>
            </div>
          </form>
        )}

        {step === doneStep && (
          <section className="iv-welcome">
            <p className="iv-eyebrow">Sent</p>
            <h1>Thank you!</h1>
            <p>Your answers help us build AQUENORA around real sellers' needs. {contact.earlyAccess ? "We'll be in touch about early access." : ''}</p>
            <p>Know other sellers? Their answers help too.</p>
            <a className="btn-dark iv-next iv-share" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
              Share on WhatsApp
            </a>
            <p className="brand-line">{TAGLINE}</p>
          </section>
        )}
      </main>
    </div>
  );
}
