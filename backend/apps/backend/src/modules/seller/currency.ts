/** Country a seller is based in -> the currency their prices are in. */
export const COUNTRY_CURRENCY = {
  NG: "ngn",
  GH: "ghs",
  ZA: "zar",
  CI: "xof",
  SN: "xof",
  DI: "usd",
} as const

export type SellerCountry = keyof typeof COUNTRY_CURRENCY

export const SELLER_COUNTRIES = Object.keys(COUNTRY_CURRENCY) as [SellerCountry, ...SellerCountry[]]
