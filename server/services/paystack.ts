import crypto from "crypto";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "";
export const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || "";
const WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || PAYSTACK_SECRET_KEY;
const BASE = "https://api.paystack.co";

async function paystackFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  const raw = (await res.json()) as { status: boolean; data: T; message?: string };
  if (!raw.status) throw new Error(raw.message ?? "Paystack error");
  return raw.data;
}

export function toPaystackPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return "+" + digits;
  if (digits.startsWith("0") && digits.length === 10) return "+254" + digits.slice(1);
  if (digits.length === 9) return "+254" + digits;
  return "+" + digits;
}

export { toPaystackPhone as normalizePhone };

export interface ChargeResponse {
  status: string;
  reference: string;
  display_text?: string;
}

export async function chargeMobileMoney(params: {
  email: string;
  amountKes: number;
  phone: string;
  provider: "mpesa" | "atl";
  reference: string;
}): Promise<ChargeResponse> {
  const normalizedPhone = toPaystackPhone(params.phone);
  const payload = {
    email: params.email,
    amount: params.amountKes,
    currency: "KES",
    mobile_money: { phone: normalizedPhone, provider: params.provider },
    reference: params.reference
  };
  return paystackFetch<ChargeResponse>("/charge", { method: "POST", body: JSON.stringify(payload) });
}

export async function getChargeStatus(reference: string): Promise<string> {
  const data = await paystackFetch<{ status: string }>(`/charge/${encodeURIComponent(reference)}`);
  return data.status;
}

export interface VerifyResult { success: boolean; amount?: number; }

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  try {
    const data = await paystackFetch<{ status: string; amount: number }>(`/transaction/verify/${encodeURIComponent(reference)}`);
    return { success: data.status === "success", amount: data.amount };
  } catch {
    return { success: false };
  }
}

export interface InitResult { authorizationUrl?: string; accessCode?: string; success: boolean; }

export async function initializeTransaction(
  email: string, amountKes: number, reference: string, metadata: Record<string, unknown>
): Promise<InitResult> {
  try {
    const data = await paystackFetch<{ authorization_url: string; access_code: string; reference: string }>(
      "/transaction/initialize",
      {
        method: "POST",
        body: JSON.stringify({ email, amount: amountKes * 100, reference, metadata, currency: "KES" })
      }
    );
    return { success: true, authorizationUrl: data.authorization_url, accessCode: data.access_code };
  } catch {
    return { success: false };
  }
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const hash = crypto.createHmac("sha512", WEBHOOK_SECRET).update(body).digest("hex");
  return hash === signature;
}
