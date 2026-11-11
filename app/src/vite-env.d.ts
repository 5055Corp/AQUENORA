/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** AQUENORA backend URL, e.g. http://localhost:9000. Leave unset for the browser-only demo. */
  readonly VITE_API_URL?: string;
  /** Medusa publishable API key, needed by the public store page (see backend README). */
  readonly VITE_MEDUSA_PUBLISHABLE_KEY?: string;
  /** Domain shops live under, e.g. aquenora.com. Unset until the domain is live. */
  readonly VITE_STORE_DOMAIN?: string;
}
