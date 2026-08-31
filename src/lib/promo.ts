import { supabase } from "./supabase";

export type PromoCodeRow = {
  id: string;
  code: string;
  discount_percent: number;
  package_code: string | null;
  note: string | null;
  expires_at: string | null;
  is_active: boolean;
  redeemed_by: string | null;
  redeemed_account_id: string | null;
  redeemed_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type PromoCheck = {
  valid: boolean;
  reason: string;
  discount_percent: number;
  package_code: string | null;
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

export function generateCode(prefix = "CD", length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  const clean = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean ? `${clean}-${body}` : body;
}

/* ------------------------------------------------------------------ admin */

export async function fetchPromoCodes(): Promise<PromoCodeRow[]> {
  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PromoCodeRow[];
}

export type NewPromoInput = {
  quantity: number;
  prefix: string;
  discount_percent: number;
  package_code: string | null;
  note: string | null;
  expires_at: string | null;
};

export async function createPromoCodes(input: NewPromoInput): Promise<PromoCodeRow[]> {
  const { data: auth } = await supabase.auth.getUser();
  const qty = Math.max(1, Math.min(100, Math.floor(input.quantity)));
  const rows = Array.from({ length: qty }, () => ({
    code: generateCode(input.prefix),
    discount_percent: input.discount_percent,
    package_code: input.package_code,
    note: input.note,
    expires_at: input.expires_at,
    created_by: auth.user?.id ?? null,
  }));
  const { data, error } = await supabase.from("promo_codes").insert(rows).select("*");
  if (error) throw error;
  return (data ?? []) as PromoCodeRow[];
}

export async function setPromoActive(id: string, isActive: boolean) {
  const { error } = await supabase.from("promo_codes").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function deletePromoCode(id: string) {
  const { error } = await supabase.from("promo_codes").delete().eq("id", id);
  if (error) throw error;
}

/* ------------------------------------------------------------------- user */

function firstCheck(data: unknown): PromoCheck {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { valid: false, reason: "Could not check this promo code", discount_percent: 0, package_code: null };
  }
  const r = row as Record<string, unknown>;
  return {
    valid: Boolean(r["valid"]),
    reason: String(r["reason"] ?? ""),
    discount_percent: Number(r["discount_percent"] ?? 0),
    package_code: (r["package_code"] as string | null) ?? null,
  };
}

/** Read-only check — does not consume the code. */
export async function validatePromoCode(code: string, packageCode?: string | null): Promise<PromoCheck> {
  const { data, error } = await supabase.rpc("validate_promo_code", {
    _code: code,
    _package_code: packageCode ?? null,
  });
  if (error) throw error;
  return firstCheck(data);
}

/** Consumes the code (single use) for the signed-in user. */
export async function redeemPromoCode(
  code: string,
  accountId: string | null,
  packageCode?: string | null,
): Promise<PromoCheck> {
  const { data, error } = await supabase.rpc("redeem_promo_code", {
    _code: code,
    _account_id: accountId,
    _package_code: packageCode ?? null,
  });
  if (error) throw error;
  return firstCheck(data);
}
