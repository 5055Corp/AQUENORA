// The AQUENORA iPhone app (Capacitor, see capacitor.config.ts) runs this same seller app.
// Everything here is a no-op in a normal browser.
import { Capacitor } from '@capacitor/core';
import { InAppReview } from '@capacitor-community/in-app-review';
import { Share } from '@capacitor/share';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

/** True inside the iPhone app. */
export const IOS_APP = Capacitor.getPlatform() === 'ios';

/**
 * Pro is bought on the website only (App Store rule 3.1.1: digital upgrades bought inside an
 * iPhone app must use Apple's in-app purchase). So the app never offers or links to an upgrade;
 * sellers who already have Pro keep all of it.
 */
export const SELL_PRO_HERE = !IOS_APP;

/** Opens the iPhone share sheet (WhatsApp, Instagram, Messages, Copy…). */
export async function shareStore(url: string, shopName: string): Promise<void> {
  await Share.share({ title: shopName, text: `Visit my shop: ${url}`, url, dialogTitle: 'Share your store' });
}

/** Shares a link: the iPhone share sheet, the browser's share sheet, or throws so the caller can copy it. */
export async function shareLink(url: string, text: string): Promise<void> {
  if (IOS_APP) {
    await Share.share({ text, url, dialogTitle: 'Share' });
    return;
  }
  if (!navigator.share) throw new Error('no share');
  try {
    await navigator.share({ text, url });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    throw e;
  }
}

/** Dark status-bar text on the app's light pages; hide the launch screen once the app has drawn. */
export function startNative(): void {
  if (!IOS_APP) return;
  document.documentElement.classList.add('ios-app');
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  requestAnimationFrame(() => SplashScreen.hide().catch(() => {}));
}

/**
 * After a seller's 3rd paid order, asks once for an App Store rating with Apple's own box
 * (Apple decides whether to show it, at most 3 times a year).
 */
export function maybeAskForRating(paidOrders: number): void {
  if (!IOS_APP || paidOrders < 3) return;
  try {
    if (localStorage.getItem('aq-rating-asked')) return;
    localStorage.setItem('aq-rating-asked', new Date().toISOString());
  } catch {
    return;
  }
  // A moment after the store opens, so it doesn't cover the screen straight away.
  setTimeout(() => InAppReview.requestReview().catch(() => {}), 4000);
}
