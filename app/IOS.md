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
