# AQUENORA iPhone app

The iPhone app is this seller app inside a native shell ([Capacitor](https://capacitorjs.com)).
Bundle ID `com.aquenora.seller`, iPhone only, portrait. Native project: `ios/`.

On iPhone the app never offers Pro (App Store rule 3.1.1): sellers upgrade on the website and
keep Pro in the app (`SELL_PRO_HERE` in `src/native.ts`). Settings has Delete account (rule 5.1.1(v)).

## One-time setup on the Mac

1. Install **Xcode** (Mac App Store) and **Node.js LTS** (nodejs.org).
2. Download the code: on GitHub, **Code → Download ZIP**, unzip it, or `git clone`.
3. Open **Terminal**, go into the `app` folder and install:
   ```sh
   cd ~/Downloads/AQUENORA-main/app
   npm install
   ```

## Build and run

```sh
npm run ios:build   # builds the app with .env.ios and copies it into ios/
npm run ios:open    # opens the project in Xcode
```

In Xcode:
1. Click **App** (blue icon, top of the left list) → **Signing & Capabilities** → tick
   **Automatically manage signing** → **Team**: choose your Apple Developer account.
2. Plug in your iPhone (or pick a simulator) at the top, then press **▶ Run**.
   On a real iPhone, the first time: iPhone **Settings → Privacy & Security → Developer Mode → On**.

## Upload to App Store Connect

1. At the top of Xcode, choose **Any iOS Device (arm64)** as the destination.
2. **Product → Archive**. When it finishes the Organizer window opens.
3. **Distribute App → App Store Connect → Distribute**.
4. After about 15 minutes the build appears in App Store Connect → TestFlight.

For each new upload, raise **Build** (App target → General → Identity), e.g. 1 → 2.
Change **Version** (1.0 → 1.1) for a new App Store release.

## Backend setting the app needs

The app talks to `https://api.aquenora.com` from the origin `capacitor://localhost`, so the
backend's `STORE_CORS`, `AUTH_CORS` and `SELLER_CORS` must each include `capacitor://localhost`.

## Push notifications (from version 1.2)

Sellers get a notification for a new order, a problem reported on an order, a buyer's reply,
and their verification result. Tapping it opens the right tab.

1. **Xcode, once:** open `ios/App/App.xcodeproj`, click **App** (blue icon) → **Signing & Capabilities** →
   **+ Capability** → **Push Notifications**.
2. **Apple key, once:** [developer.apple.com](https://developer.apple.com/account/resources/authkeys/list) →
   Keys → **+** → name it "AQUENORA push", tick **Apple Push Notifications service (APNs)** → Continue →
   Register → **Download** the `.p8` file (you can only download it once). Note the **Key ID** and your
   **Team ID** (top right of the page).
3. **Railway → backend → Variables** (never paste the key anywhere else):
   - `APNS_KEY` = the whole text of the `.p8` file (open it in TextEdit, copy everything)
   - `APNS_KEY_ID` = the Key ID
   - `APNS_TEAM_ID` = the Team ID
   - `APNS_BUNDLE_ID` = `com.aquenora.seller`

Without these variables the app still works; it just sends no notifications.

## Live updates (from version 1.2)

Every website deploy also publishes the same screens for the iPhone app at
`app.aquenora.com/live/manifest.json`. The app checks it when it opens, downloads anything newer
in the background, and shows it the next time it's opened. If a new version fails to start, the app
goes back to the last one that worked by itself.

Live updates only carry screens, text, styles and pictures. A new **native** feature (a new plugin,
permission or capability) still needs an App Store update: build it with `npm run ios:build`, upload
it, and set the second argument of `scripts/live-bundle.mjs` in the `Dockerfile` (`min_native`, now
`1.2`) to the new version, so older App Store versions don't download screens they can't run.
