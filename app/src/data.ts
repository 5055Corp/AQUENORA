// Static content for the AQENORA seller app. Values match the Claude Design prototype.

export type CountryId = 'NG' | 'GH' | 'ZA' | 'CI' | 'SN' | 'DI';

export interface Country {
  id: CountryId;
  name: string;
  sym: string;
  curName: string;
  /** Local currency units per 1 USD (rough, for demo figures only). */
  rate: number;
  /** Paystack fee sentence for this country. */
  local: string;
}

export const COUNTRIES: Country[] = [
  { id: 'NG', name: 'Nigeria', sym: '₦', curName: 'Naira', rate: 1550, local: 'cards, bank transfer and USSD: 1.5% + ₦100 per sale (max ₦2,000).' },
  { id: 'GH', name: 'Ghana', sym: 'GH₵', curName: 'Cedis', rate: 15, local: 'cards, mobile money and bank transfer: 1.95% per sale.' },
  { id: 'ZA', name: 'South Africa', sym: 'R', curName: 'Rand', rate: 18, local: 'cards: 2.9% + R1 per sale, EFT: 2% (plus VAT).' },
  { id: 'CI', name: "Côte d'Ivoire", sym: 'CFA ', curName: 'CFA francs', rate: 600, local: 'local rates shown when you connect.' },
  { id: 'SN', name: 'Senegal', sym: 'CFA ', curName: 'CFA francs', rate: 600, local: 'local rates shown when you connect.' },
  { id: 'DI', name: 'Abroad (diaspora seller)', sym: '$', curName: 'US dollars', rate: 1, local: 'rates depend on where your business is registered.' },
];

export const CATEGORIES = [
  'Fashion & clothing',
  'Beauty & hair',
  'Art & crafts',
  'Food & drinks',
  'Home & decor',
  'Digital products',
];

export const STEPS: [title: string, sub: string][] = [
  ['What do you sell?', "Pick the closest one. We'll set up your store to suit it."],
  ["What's your shop called?", 'You can change this any time.'],
  ['Where is your business based?', 'Your customers will see prices in your local money.'],
  ['Add your first product', 'Just one is enough to open your store.'],
  ['How do you want to get paid?', 'Connect Paystack and money goes straight to your bank account.'],
];

export type ThemeId = 'harmattan' | 'lagos' | 'savanna';

export interface StoreTheme {
  label: string;
  desc: string;
  bg: string;
  ink: string;
  card: string;
  /** Placeholder stripe colours. */
  sa: string;
  sb: string;
}

export const THEMES: Record<ThemeId, StoreTheme> = {
  harmattan: { label: 'Harmattan', desc: 'Warm and calm', bg: '#f7f1e8', ink: '#2a211a', card: '#fffaf3', sa: '#ebe2d4', sb: '#f3ecdf' },
  lagos: { label: 'Lagos Night', desc: 'Dark and bold', bg: '#16130f', ink: '#f6efe4', card: '#221e19', sa: '#2a251f', sb: '#332d26' },
  savanna: { label: 'Savanna', desc: 'Fresh and light', bg: '#eef0e6', ink: '#1f2a1c', card: '#ffffff', sa: '#dfe3d3', sb: '#e8ebde' },
};

export const ACCENTS = [
  { name: 'Terracotta', color: 'oklch(0.6 0.15 40)' },
  { name: 'Leaf', color: 'oklch(0.6 0.15 150)' },
  { name: 'Indigo', color: 'oklch(0.6 0.15 265)' },
  { name: 'Hibiscus', color: 'oklch(0.6 0.15 345)' },
];

export type FontId = 'classic' | 'modern' | 'friendly';

export const FONTS: Record<FontId, { label: string; family: string }> = {
  classic: { label: 'Classic', family: "'Newsreader', serif" },
  modern: { label: 'Modern', family: "'Manrope', sans-serif" },
  friendly: { label: 'Friendly', family: "'Fredoka', sans-serif" },
};

export type OrderStatus = 'new' | 'shipped' | 'delivered' | 'canceled';

export interface Order {
  id: string;
  name: string;
  place: string;
  item: string;
  /** Order value in USD; converted to the seller's currency for display. */
  usd: number;
  intl?: boolean;
  status: OrderStatus;
  /** Live orders: total in the seller's own currency (demo orders use usd). */
  amount?: number;
  created_at?: string;
}

export const ORDERS: Order[] = [
  { id: '1042', name: 'Adaeze Okafor', place: 'Lagos', item: 'Indigo adire kimono', usd: 18, status: 'new' },
  { id: '1041', name: 'Kwame Mensah', place: 'London, UK', item: 'Adire tote bag', usd: 24, intl: true, status: 'new' },
  { id: '1040', name: 'Ifeoma Bello', place: 'Abuja', item: 'Silk head wrap ×2', usd: 12, status: 'shipped' },
  { id: '1039', name: 'Amara Diallo', place: 'Paris, France', item: 'Indigo adire kimono', usd: 36, intl: true, status: 'delivered' },
];

export const STATUS: Record<OrderStatus, { label: string; bg: string; color: string; action?: string; next?: OrderStatus }> = {
  new: { label: 'Paid, ready to pack', bg: 'oklch(0.93 0.05 40)', color: 'oklch(0.42 0.13 40)', action: 'Mark as shipped', next: 'shipped' },
  shipped: { label: 'On the way', bg: 'oklch(0.93 0.05 265)', color: 'oklch(0.42 0.13 265)', action: 'Mark as delivered', next: 'delivered' },
  delivered: { label: 'Delivered', bg: 'oklch(0.93 0.05 150)', color: 'oklch(0.4 0.12 150)' },
  canceled: { label: 'Cancelled', bg: '#efe8dc', color: '#6b645a' },
};

export type OrderFilter = 'all' | OrderStatus;

export const ORDER_FILTERS: [OrderFilter, string][] = [
  ['all', 'All'],
  ['new', 'To pack'],
  ['shipped', 'On the way'],
  ['delivered', 'Delivered'],
];

export type Tab = 'home' | 'orders' | 'products' | 'money' | 'customers' | 'design';

export const NAV: { key: Tab; label: string; short: string }[] = [
  { key: 'home', label: 'Home', short: 'Home' },
  { key: 'orders', label: 'Orders', short: 'Orders' },
  { key: 'products', label: 'Products', short: 'Products' },
  { key: 'money', label: 'Money', short: 'Money' },
  { key: 'customers', label: 'Customers', short: 'Buyers' },
  { key: 'design', label: 'Store design', short: 'Design' },
];

export interface Product {
  /** Set for products saved in the backend. */
  id?: string;
  name: string;
  price: number;
  stock: number;
  /** What one item costs the seller. undefined = not set yet (demo samples get a made-up one). */
  cost?: number | null;
}

export const HELP = {
  url: 'This is the link customers type or tap to visit your shop. You can send it on WhatsApp or put it in your Instagram bio. You can switch to your own address (like adirehouse.com) later on the Pro plan.',
  pay: "Paystack moves money from your customer's card or bank into your bank account, usually the next working day. Setup is free; Paystack keeps a small fee from each sale. AQENORA never holds your money.",
  checklistPay: "Paystack moves money from your customer's card or bank into your bank account. Setup is free. It keeps a small fee from each sale.",
  checklistShare: 'Most first sales come from people who already know you. Post your link on your WhatsApp status and Instagram bio.',
};
