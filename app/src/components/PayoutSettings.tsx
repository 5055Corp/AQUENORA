import { useEffect, useState } from 'react';
import { api, type Bank } from '../api';
import { estimatePaymentFee } from '../finance';
import { useStore } from '../store';

/** Demo mode: a few real Nigerian banks so the form can be tried without Paystack. */
const DEMO_BANKS: Bank[] = [
  { name: 'Access Bank', code: '044' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'Guaranty Trust Bank', code: '058' },
  { name: 'Kuda Bank', code: '50211' },
  { name: 'Moniepoint MFB', code: '50515' },
  { name: 'OPay', code: '999992' },
  { name: 'United Bank For Africa', code: '033' },
  { name: 'Zenith Bank', code: '057' },
];

/** Sample sale used to show how a payment is split. */
const EXAMPLE_USD = 20;

/**
 * "Get paid": the seller's bank account. Paystack pays each sale straight into it, after taking
 * its own fee and AQUENORA's commission.
 */
export function PayoutSettings({ id }: { id?: string }) {
  const { s, live, savePayout, planInfo, country, fmt, fromUsd } = useStore();
  const [editing, setEditing] = useState(false);
  const [banks, setBanks] = useState<Bank[] | null>(live ? null : DEMO_BANKS);
  const [loadError, setLoadError] = useState('');
  const [code, setCode] = useState('');
  const [account, setAccount] = useState('');
  const [error, setError] = useState('');
  const open = editing || !s.payout;

  useEffect(() => {
    if (!live || !open || banks) return;
    let stale = false;
    api.banks(s.token)
      .then(r => !stale && setBanks(r.banks))
      .catch(e => !stale && setLoadError(e instanceof Error ? e.message : 'Could not load banks.'));
    return () => { stale = true; };
  }, [live, open, banks, s.token]);

  const save = async () => {
    const bank = banks?.find(b => b.code === code);
    const msg = await savePayout({ code, name: bank?.name ?? '' }, account);
    setError(msg);
    if (!msg) { setEditing(false); setAccount(''); }
  };

  // How one sale is split: AQUENORA's commission, Paystack's fee, and what the seller gets.
  const pct = planInfo?.plan.commission_percent ?? 3;
  const sale = Math.round(fromUsd(EXAMPLE_USD) / 100) * 100 || EXAMPLE_USD;
  const ours = Math.round(sale * pct) / 100;
  const paystackFee = estimatePaymentFee(country.id, sale);
  const yours = sale - ours - paystackFee;

  return (
    <section id={id} className="card payout-card" aria-labelledby="payout-title">
      <div className="pickup-head">
        <div>
          <h2 id="payout-title" className="card-title">Get paid</h2>
          {s.payout && !editing ? (
            <p className="pickup-sub">
              Sales are paid into <b>{s.payout.bank_name} ••••{s.payout.account_last4}</b>
              {s.payout.account_name ? ` (${s.payout.account_name})` : ''}, usually the next working day.
            </p>
          ) : (
            <p className="pickup-sub">Connect the bank account your sales should go into. Paystack pays you directly. AQUENORA never holds your money.</p>
          )}
        </div>
        {s.payout && (
          <button type="button" className="btn-sm pickup-edit" onClick={() => { setEditing(e => !e); setError(''); }}>
            {editing ? 'Cancel' : 'Change'}
          </button>
        )}
      </div>

      {open && (
        <div className="pickup-form">
          {loadError ? (
            <div className="form-error" role="alert">{loadError}</div>
          ) : (
            <>
              <label className="ob-label">Bank
                <select className="field pickup-input" value={code} disabled={!banks} onChange={e => { setCode(e.target.value); setError(''); }}>
                  <option value="">{banks ? 'Choose your bank' : 'Loading banks…'}</option>
                  {banks?.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
              </label>
              <label className="ob-label">Account number
                <input className="field pickup-input" inputMode="numeric" autoComplete="off" maxLength={20} value={account}
                  placeholder={country.id === 'NG' ? '10-digit NUBAN, e.g. 0123456789' : 'Your account number'}
                  onChange={e => { setAccount(e.target.value.replace(/\s+/g, '')); setError(''); }} />
              </label>
              {error && <div className="form-error" role="alert">{error}</div>}
              <div className="pickup-actions">
                <button type="button" className="btn-dark btn-sm" disabled={s.busy || !code || !account} onClick={save}>
                  {s.busy ? 'Checking with Paystack…' : 'Connect bank account'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <dl className="split" aria-label={`How a ${fmt(sale)} sale is split`}>
        <div className="split-head">On a {fmt(sale)} sale</div>
        <div><dt>AQUENORA ({pct}%)</dt><dd>{fmt(ours)}</dd></div>
        <div><dt>Paystack fee (about)</dt><dd>{fmt(paystackFee)}</dd></div>
        <div className="split-you"><dt>Paid to you</dt><dd>{fmt(yours)}</dd></div>
      </dl>
    </section>
  );
}
