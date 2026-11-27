// AQUENORA owner (admin) screens in the app: signs in with the Medusa admin login and calls /admin.
import { API_URL, LIVE } from '../api';

const KEY = 'aq-owner-token';
export const ownerToken = (): string => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };
const saveToken = (t: string) => { try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch { /* storage unavailable */ } };
export const ownerSignOut = () => saveToken('');

/** The full admin website (Medusa admin). */
export const FULL_ADMIN_URL = `${API_URL || 'https://api.aquenora.com'}/app`;

export class OwnerError extends Error { status: number; constructor(status: number, m: string) { super(m); this.status = status; } }

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${ownerToken()}` },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new OwnerError(0, "Can't reach AQUENORA. Check your connection.");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { saveToken(''); throw new OwnerError(401, 'Please sign in to the owner area again.'); }
  if (!res.ok) throw new OwnerError(res.status, data?.message || 'Something went wrong. Please try again.');
  return data as T;
}

export async function ownerSignIn(email: string, password: string): Promise<void> {
  // Demo app: owner@aquenora.demo opens the sample owner area (previews only).
  if (!LIVE) { if (email !== 'owner@aquenora.demo') throw new OwnerError(401, 'Not an admin'); saveToken('demo'); return; }
  const res = await fetch(`${API_URL}/auth/user/emailpass`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
    .catch(() => { throw new OwnerError(0, "Can't reach AQUENORA. Check your connection."); });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) throw new OwnerError(res.status, res.status === 401 ? "That email and password don't match an AQUENORA admin." : 'Could not sign in. Please try again.');
  saveToken(data.token);
}

export type Money = Record<string, number>;
export interface Overview {
  period: 'month' | 'last' | 'all';
  sales: Money; commission: Money; orders: number;
  previous: { sales: Money; commission: Money; orders: number } | null;
  sellers: { total: number; new: number; new_previous: number | null; pro: number; trial: number; suspended: number };
  top_stores: { id: string; name: string; handle: string; sales: Money; orders: number }[];
  needs_you: { verifications: number; disputes: number; escalated: number; reported_products: number };
}
export interface OwnerSeller { id: string; name: string; handle: string; email: string; country_code: string; verification_status: string; suspended_at: string | null; suspend_reason?: string | null; pro_paid_until?: string | null; created_at: string; category?: string; verification?: { type?: string; business_name?: string; cac_number?: string; id_type?: string; socials?: Record<string, string> } | null }
export interface OwnerDispute { id: string; order_display_id: number; reason_label: string; status: string; messages: { from: string; text: string; at: string }[]; refund: { amount: number } | null; buyer_name: string; seller: { name: string; handle: string; email: string } | null; created_at: string }
export interface OwnerReport { report_id: string; count: number; reasons: Record<string, number>; notes: string[]; product: { id: string; title: string; thumbnail: string | null; hidden: boolean } | null; seller: { id: string; name: string; handle: string } | null }

export const ownerApi = {
  overview: (period: Overview['period']) => call<Overview>(`/admin/overview?period=${period}`),
  verifications: () => call<{ sellers: OwnerSeller[] }>('/admin/verifications?status=pending'),
  documents: (id: string) => call<{ documents: { id: string; kind: string; mime_type: string }[] }>(`/admin/verifications/${id}`),
  reviewVerification: (id: string, decision: 'approve' | 'reject', reason?: string) => call(`/admin/verifications/${id}`, { body: { decision, ...(reason ? { reason } : {}) } }),
  disputes: () => call<{ disputes: OwnerDispute[] }>('/admin/disputes?status=escalated'),
  decide: (id: string, outcome: 'refund_required' | 'seller', text: string, amount?: number) => call(`/admin/disputes/${id}`, { body: { action: 'decide', outcome, text, ...(amount ? { amount } : {}) } }),
  reports: () => call<{ reports: OwnerReport[] }>('/admin/reports'),
  reviewReport: (id: string, action: 'hide' | 'dismiss', reason?: string) => call(`/admin/reports/${id}`, { body: { action, ...(reason ? { reason } : {}) } }),
  sellers: (q: string) => call<{ sellers: OwnerSeller[] }>(`/admin/sellers?q=${encodeURIComponent(q)}`),
  suspend: (id: string, suspend: boolean, reason?: string) => call(`/admin/sellers/${id}/suspend`, { body: { suspend, ...(reason ? { reason } : {}) } }),
  /** Opens a verification document (private) in a new tab. */
  async openDocument(sellerId: string, docId: string) {
    const res = await fetch(`${API_URL}/admin/verifications/${sellerId}/documents/${docId}`, { headers: { authorization: `Bearer ${ownerToken()}` } });
    if (!res.ok) throw new OwnerError(res.status, 'Could not open the document.');
    window.open(URL.createObjectURL(await res.blob()), '_blank');
  },
};
