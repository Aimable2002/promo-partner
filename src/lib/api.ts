import { supabase } from "./supabase";

export const API_BASE_URL =
  import.meta.env["VITE_API_BASE_URL"] ?? "https://surviving-cork-lushness.ngrok-free.dev";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function detailToMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) =>
        d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : null,
      )
      .filter(Boolean);
    if (msgs.length) return msgs.join(", ");
  }
  return fallback;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip attaching the Supabase bearer token (public endpoints). */
  anonymous?: boolean;
  signal?: AbortSignal;
};

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, anonymous = false, signal } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (!anonymous) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new ApiError("Could not reach the CopyDesk service. Check your connection.", 0);
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const detail =
      parsed && typeof parsed === "object" && "detail" in parsed
        ? (parsed as { detail: unknown }).detail
        : parsed;
    throw new ApiError(detailToMessage(detail, `Request failed (${res.status})`), res.status);
  }

  return parsed as T;
}

export const api = {
  get: <T = unknown>(path: string, opts: Omit<RequestOptions, "method" | "body"> = {}) =>
    apiFetch<T>(path, { ...opts, method: "GET" }),
  post: <T = unknown>(path: string, body?: unknown, opts: Omit<RequestOptions, "method"> = {}) =>
    apiFetch<T>(path, { ...opts, method: "POST", body: body ?? {} }),
};

/* ------------------------------------------------------- shared shapes */

export type Deal = {
  deal_ticket: number | string;
  symbol: string;
  type: string;
  lots: number;
  entry: "in" | "out" | string;
  deal_time: string;
  pnl: number;
  price?: number;
  commission?: number;
  swap?: number;
  volume?: number;
};

export type DirectoryMaster = {
  account_id: string;
  display_name: string | null;
  bio: string | null;
  country: string | null;
  platform: string | null;
  broker: string | null;
  /** From live_account_state, resolved backend-side with the service-role
   *  client - not readable directly by a non-owner via Supabase RLS, so
   *  this is the only reliable source for a public master's balance. */
  balance: number | null;
  equity: number | null;
};

export type MasterFollower = {
  follower_account_id: string;
  broker: string | null;
  platform: string | null;
  equity: number | null;
  sizing_mode: string | null;
  sizing_value: number | null;
  since: string | null;
  status: string | null;
};

export type ChallengeEnrollment = {
  id?: string;
  challenge_id: string;
  status: string;
  starting_equity: number;
  peak_equity: number;
  day_start_equity: number;
  day_start_date: string | null;
  breach_reason: string | null;
  enrolled_at: string;
};

export type ChallengeStatus = {
  phase: "challenger" | "graduated" | string;
  current_enrollment: ChallengeEnrollment | null;
  equity_curve: { snapshot_date: string; equity: number }[];
};

/* ------------------------------------------------------------ wrappers */

const tradesOf = (list: unknown): Deal[] => {
  if (Array.isArray(list)) return list as Deal[];
  if (list && typeof list === "object") {
    const obj = list as Record<string, unknown>;
    for (const key of ["trades", "deals", "items", "data"]) {
      if (Array.isArray(obj[key])) return obj[key] as Deal[];
    }
  }
  return [];
};

export const listAsArray = tradesOf;

export type ChallengeApiRow = {
  id: string;
  name: string;
  description: string | null;
  is_fixed: boolean;
  fee: number;
  profit_target_pct: number;
  max_daily_loss_pct: number;
  max_drawdown_pct: number;
  min_days: number;
  reward_amount: number | null;
  active: boolean;
  created_at?: string | null;
};

export type PaymentCurrency = {
  code: string;
  name: string;
  rate_per_usd: number | null;
  mobile_money: boolean;
  country: string;
};

export type CheckoutBody = {
  account_id: string;
  purpose: "package" | "challenge_entry";
  amount_usd?: number | null;
  package_code?: string | null;
  challenge_id?: string | null;
  currency: string;
  method: "mobilemoney" | "card" | "banktransfer";
  phone_number?: string | null;
  network?: string | null;
  redirect_url: string;
};

export type ProvisionBody = {
  role: "master" | "follower";
  login: string;
  password: string;
  server: string;
  broker?: string | null;
  master_account_id?: string | null;
  sizing_mode?: "proportional" | "fixed-lot" | "micro-scale" | "risk-percent" | null;
  sizing_value?: number | null;
};

export type PayoutBody = {
  amount: number;
  recipient_name: string;
  recipient_phone: string;
  payout_method: "mobile_money" | "bank_transfer" | "crypto";
  payout_account_number: string;
};

/** Unwraps `{ <key>: [...] }` envelopes the backend uses on some list routes. */
export function unwrapList<T>(res: unknown, ...keys: string[]): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object") {
    const obj = res as Record<string, unknown>;
    for (const k of [...keys, "items", "data", "results"]) {
      if (Array.isArray(obj[k])) return obj[k] as T[];
    }
  }
  return [];
}

export const endpoints = {
  /* ------------------------------------------------------------- public */
  challenges: () =>
    api
      .get<ChallengeApiRow[] | { challenges: ChallengeApiRow[] }>("/challenges")
      .then((r) => unwrapList<ChallengeApiRow>(r, "challenges")),
  mastersDirectory: () =>
    api
      .get<DirectoryMaster[] | { masters: DirectoryMaster[] }>("/masters/directory")
      .then((r) => unwrapList<DirectoryMaster>(r, "masters")),
  currencies: () =>
    api
      .get<{ currencies: PaymentCurrency[] }>("/payments/currencies", { anonymous: true })
      .then((r) => unwrapList<PaymentCurrency>(r, "currencies")),
  platformStats: () =>
    api.get<{
      masters_count: number;
      live_accounts_count: number;
      copied_today: number;
      avg_relay_latency_seconds_30d: number | null;
      avg_relay_latency_sample_size_30d: number;
    }>("/platform/stats", { anonymous: true }),
  quote: (body: { amount_usd: number; currency: string }) =>
    api.post<Record<string, unknown>>("/payments/quote", body, { anonymous: true }),

  /* ---------------------------------------------------------- accounts */
  provision: (body: ProvisionBody) =>
    api.post<{ status?: string; account_id?: string; message?: string }>(
      "/accounts/provision",
      body,
    ),
  ctraderStart: (body: Record<string, unknown>) =>
    api.post<{ redirect_url?: string; url?: string; authorization_url?: string }>(
      "/accounts/ctrader/start",
      body,
    ),
  accountTrades: (accountId: string) => api.get(`/accounts/${accountId}/trades`).then(tradesOf),
  pauseAccount: (accountId: string, forceClose = false) =>
    api.post(`/accounts/${accountId}/pause`, { force_close: forceClose }),
  resumeAccount: (accountId: string) => api.post(`/accounts/${accountId}/resume`),
  closeAccount: (accountId: string) => api.post(`/accounts/${accountId}/close`),
  roster: (accountId: string) => api.get(`/accounts/${accountId}/roster`),
  switchMaster: (accountId: string, masterAccountId: string) =>
    api.post(`/accounts/${accountId}/roster/switch`, { master_account_id: masterAccountId }),

  /* ----------------------------------------------------------- masters */
  masterTrades: (accountId: string) => api.get(`/masters/${accountId}/trades`).then(tradesOf),
  masterFollowers: (accountId: string) =>
    api
      .get<MasterFollower[] | { followers: MasterFollower[] }>(`/masters/${accountId}/followers`)
      .then((r) => unwrapList<MasterFollower>(r, "followers")),
  masterEarnings: (accountId: string) =>
    api.get<Record<string, unknown>>(`/masters/${accountId}/earnings`),
  masterPayouts: (accountId: string) =>
    api
      .get<Record<string, unknown>[]>(`/masters/${accountId}/payouts`)
      .then((r) => unwrapList<Record<string, unknown>>(r, "payouts")),
  requestPayout: (accountId: string, body: PayoutBody) =>
    api.post(`/masters/${accountId}/payouts`, body),
  updateMasterProfile: (
    accountId: string,
    body: { display_name: string; bio?: string; country?: string | null },
  ) => api.post(`/masters/${accountId}/profile`, body),

  /* -------------------------------------------------------- challenges */
  challengeStatus: (accountId: string) =>
    api.get<ChallengeStatus>(`/masters/${accountId}/challenges/status`),
  challengeHistory: (accountId: string) =>
    api
      .get(`/masters/${accountId}/challenges/history`)
      .then((r) => unwrapList<Record<string, unknown>>(r, "history", "enrollments")),
  leaveChallenge: (accountId: string, challengeId: string) =>
    api.post(`/masters/${accountId}/challenges/${challengeId}/leave`),

  /* ------------------------------------------------------------ billing */
  billing: (accountId: string) =>
    api.get<Record<string, unknown>>(`/accounts/${accountId}/billing`),
  selectPackage: (accountId: string, packageCode: string) =>
    api.post(`/accounts/${accountId}/billing/select-package`, { package_code: packageCode }),
  reactivateBilling: (accountId: string) => api.post(`/accounts/${accountId}/billing/reactivate`),

  /* ---------------------------------------------------------- payments */
  checkout: (body: CheckoutBody) => api.post<Record<string, unknown>>("/payments/checkout", body),
  paymentStatus: (reference: string) =>
    api.get<Record<string, unknown>>(`/payments/${encodeURIComponent(reference)}`),

  /* ------------------------------------------------------------- admin */
  adminSummary: () => api.get<Record<string, unknown>>("/admin/summary"),
  adminRevenue: () => api.get("/admin/analytics/revenue"),
  adminGrowth: () => api.get("/admin/analytics/growth"),
  adminSymbolExposure: () => api.get("/admin/analytics/symbol-exposure"),
  adminTopMasters: () => api.get("/admin/analytics/top-masters"),
  adminUsers: () =>
    api.get("/admin/users").then((r) => unwrapList<Record<string, unknown>>(r, "users")),
  adminMasters: () =>
    api.get("/admin/masters").then((r) => unwrapList<Record<string, unknown>>(r, "masters")),
  adminMaster: (accountId: string) =>
    api.get<Record<string, unknown>>(`/admin/masters/${accountId}`),
  adminSetMasterPublic: (accountId: string, isPublic: boolean) =>
    api.post(`/admin/masters/${accountId}/public`, { public: isPublic, is_public: isPublic }),
  adminPayouts: () =>
    api.get("/admin/payouts").then((r) => unwrapList<Record<string, unknown>>(r, "payouts")),
  adminApprovePayout: (payoutId: string) => api.post(`/admin/payouts/${payoutId}/approve`),
  adminRejectPayout: (payoutId: string) => api.post(`/admin/payouts/${payoutId}/reject`),
};
