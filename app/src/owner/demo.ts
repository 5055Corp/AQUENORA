// Sample owner data for the demo app (previews only; the live app loads real data).
import type { Overview, OwnerDispute, OwnerReport, OwnerSeller } from './ownerApi';

const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

export const DEMO_OVERVIEW: Overview = {
  period: 'month',
  sales: { ngn: 4_860_000 }, commission: { ngn: 243_000 }, orders: 182,
  previous: { sales: { ngn: 3_920_000 }, commission: { ngn: 196_000 }, orders: 149 },
  sellers: { total: 64, new: 11, new_previous: 7, pro: 9, trial: 5, suspended: 1 },
  top_stores: [
    { id: '1', name: 'Adire House', handle: 'adirehouse', sales: { ngn: 1_240_000 }, orders: 41 },
    { id: '2', name: 'Crown & Strands', handle: 'crownstrands', sales: { ngn: 980_000 }, orders: 22 },
    { id: '3', name: 'Kente Corner', handle: 'kentecorner', sales: { ngn: 610_000 }, orders: 30 },
  ],
  needs_you: { verifications: 1, disputes: 3, escalated: 1, reported_products: 1 },
};

export const DEMO_SELLERS: OwnerSeller[] = [
  { id: 's1', name: 'Zuri Naturals', handle: 'zurinaturals', email: 'hello@zurinaturals.ng', country_code: 'NG', verification_status: 'pending', suspended_at: null, created_at: day(2),
    verification: { type: 'registered', business_name: 'Zuri Naturals Ltd', cac_number: 'RC 1876543', id_type: 'nin', socials: { instagram: 'zurinaturals' } } },
  { id: 's2', name: 'Adire House', handle: 'adirehouse', email: 'shop@adirehouse.ng', country_code: 'NG', verification_status: 'verified', suspended_at: null, pro_paid_until: day(-20), created_at: day(120) },
  { id: 's3', name: 'Crown & Strands', handle: 'crownstrands', email: 'crown@strands.com', country_code: 'GH', verification_status: 'verified', suspended_at: null, created_at: day(60) },
  { id: 's4', name: 'Quick Gadgets', handle: 'quickgadgets', email: 'qg@mail.com', country_code: 'NG', verification_status: 'verified', suspended_at: day(3), suspend_reason: 'Refund not paid after AQUENORA decided', created_at: day(40) },
];

export const DEMO_DISPUTES: OwnerDispute[] = [{
  id: 'd1', order_display_id: 1088, reason_label: 'Never arrived', status: 'escalated', refund: null, buyer_name: 'Kwame Mensah', created_at: day(6),
  seller: { name: 'Quick Gadgets', handle: 'quickgadgets', email: 'qg@mail.com' },
  messages: [
    { from: 'buyer', text: 'Paid 9 days ago. Tracking shows nothing.', at: day(6) },
    { from: 'seller', text: 'We sent it with GIG last week.', at: day(4) },
    { from: 'buyer', text: 'GIG says there is no parcel with that number.', at: day(2) },
  ],
}];

export const DEMO_REPORTS: OwnerReport[] = [{
  report_id: 'r1', count: 3, reasons: { counterfeit: 2, misleading: 1 }, notes: ['The logo is fake', 'Not original'],
  product: { id: 'p1', title: '"Designer" handbag', thumbnail: null, hidden: false },
  seller: { id: 's4', name: 'Quick Gadgets', handle: 'quickgadgets' },
}];
