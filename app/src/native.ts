// The AQUENORA iPhone app (Capacitor, see capacitor.config.ts) runs this same seller app.
// Everything here is a no-op in a normal browser.
import { Capacitor } from '@capacitor/core';
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

/** Dark status-bar text on the app's light pages; hide the launch screen once the app has drawn. */
export function startNative(): void {
  if (!IOS_APP) return;
  document.documentElement.classList.add('ios-app');
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  requestAnimationFrame(() => SplashScreen.hide().catch(() => {}));
}
