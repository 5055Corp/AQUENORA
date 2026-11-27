// The AQUENORA iPhone app (Capacitor, see capacitor.config.ts) runs this same seller app.
// Everything here is a no-op in a normal browser.
import { Capacitor } from '@capacitor/core';
import { InAppReview } from '@capacitor-community/in-app-review';
import { PushNotifications } from '@capacitor/push-notifications';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
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
  checkLiveUpdate();
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

// ---------------- push notifications (sellers: new orders, problems, verification) ----------------

let pushToken = '';

/**
 * Asks once for permission to send notifications, then gives the backend this iPhone's token
 * (save). Tapping a notification calls openTab with the tab it's about ("orders"...).
 */
export async function startPush(save: (token: string) => Promise<unknown>, openTab: (tab: string) => void): Promise<void> {
  if (!IOS_APP) return;
  try {
    await PushNotifications.removeAllListeners();
    await PushNotifications.addListener('registration', t => { pushToken = t.value; save(t.value).catch(() => {}); });
    await PushNotifications.addListener('pushNotificationActionPerformed', a => {
      const tab = (a.notification.data as { tab?: string } | undefined)?.tab;
      if (tab) openTab(tab);
    });
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PushNotifications.requestPermissions();
    if (perm.receive === 'granted') await PushNotifications.register();
  } catch {
    // Notifications are a nice extra: the app works without them.
  }
}

/** On log-out: this iPhone stops getting the store's notifications. */
export async function stopPush(forget: (token: string) => Promise<unknown>): Promise<void> {
  if (!IOS_APP || !pushToken) return;
  await forget(pushToken).catch(() => {});
  pushToken = '';
}

// ---------------- live updates (new screens without an App Store update) ----------------

const SITE = 'https://app.aquenora.com';
const versionNumber = (v: string) => v.split('.').map(n => Number(n) || 0).reduce((a, n, i) => a + n * 1000 ** (2 - i), 0);

/**
 * Tells the updater this version started fine (otherwise it rolls back by itself), then checks
 * app.aquenora.com for a newer build. A newer one downloads quietly and opens the next time the app
 * is reopened. Builds that need a newer App Store version are skipped.
 */
export async function checkLiveUpdate(): Promise<void> {
  if (!IOS_APP) return;
  try {
    await CapacitorUpdater.notifyAppReady();
    const res = await fetch(`${SITE}/live/manifest.json`, { cache: 'no-store' });
    if (!res.ok) return;
    const m = await res.json() as { version?: string; url?: string; min_native?: string };
    if (!m.version || !m.url || !/^\d+$/.test(m.version) || m.version <= __BUILD_ID__) return;
    const { version: native } = await CapacitorUpdater.getBuiltinVersion();
    if (m.min_native && versionNumber(native) < versionNumber(m.min_native)) return;
    const bundle = await CapacitorUpdater.download({ url: new URL(m.url, SITE).toString(), version: m.version });
    await CapacitorUpdater.next({ id: bundle.id });
  } catch {
    // No connection or a failed download: try again next time.
  }
}
