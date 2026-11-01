/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** AQENORA backend URL, e.g. http://localhost:9000. Leave unset for the browser-only demo. */
  readonly VITE_API_URL?: string;
}
