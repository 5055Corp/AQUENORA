import { useEffect, useState } from 'react';
import { api } from '../api';
import { useStore } from '../store';
import { IOS_APP, shareLink } from '../native';

/**
 * "Invite a seller": the seller's own invite link. When an invited store makes its first sale,
 * both get a free month of Pro. (The iPhone app doesn't mention Pro: App Store rule 3.1.1.)
 */
export function InviteCard() {
  const { s, live, flash } = useStore();
  const [info, setInfo] = useState<{ link: string; joined: number; rewarded: number } | null>(
    live ? null : { link: `https://app.aquenora.com/?ref=${s.handle || 'adirehouse'}`, joined: 2, rewarded: 1 }
  );
  useEffect(() => {
    if (!live || !s.token) return;
    api.referrals(s.token).then(setInfo).catch(() => {});
  }, [live, s.token]);
  if (!info) return null;
  const share = async () => {
    const text = 'I sell online with AQUENORA: your own shop, Paystack payments and delivery. Join with my link:';
    try {
      await shareLink(info.link, text);
    } catch {
      try {
        await navigator.clipboard.writeText(info.link);
        flash('Invite link copied');
      } catch {
        /* nothing to do */
      }
    }
  };
  return (
    <section className="card money-card invite" aria-labelledby="set-invite">
      <h2 id="set-invite" className="card-title">Invite a seller</h2>
      {IOS_APP ? (
        <p className="invite-why">Know someone who sells on WhatsApp or Instagram? Send them your link to open their own AQUENORA shop.</p>
      ) : (
        <p className="invite-why">When a seller you invite makes their <b>first sale</b>, you <b>both get a free month of Pro</b>. No limit: every seller is another free month.</p>
      )}
      <div className="invite-link">{info.link.replace(/^https?:\/\//, '')}</div>
      <button type="button" className="btn-dark invite-go" onClick={share}>Share my invite link</button>
      <div className="invite-stats">
        <div><b>{info.joined}</b><span>joined</span></div>
        <div><b>{info.rewarded}</b><span>made a first sale</span></div>
        {!IOS_APP && <div><b>{info.rewarded}</b><span>{info.rewarded === 1 ? 'free month' : 'free months'} earned</span></div>}
      </div>
    </section>
  );
}
