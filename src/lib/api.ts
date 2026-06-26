const API_URL = "/api";

function getToken(): string | null {
  return localStorage.getItem("token");
}

async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {})
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

// ===== AUTH =====
export async function login(usernameOrEmail: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernameOrEmail, password })
  });
  return res.json();
}

export async function signup(email: string, username: string, password: string, referralCode?: string, fingerprint?: string) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password, referralCode, fingerprint })
  });
  return res.json();
}

export async function logout() {
  await fetchWithAuth("/auth/logout", { method: "POST" });
  localStorage.removeItem("token");
}

export async function getMe() {
  const res = await fetchWithAuth("/auth/me");
  return res.json();
}

export async function updateUsername(username: string) {
  const res = await fetchWithAuth("/auth/username", {
    method: "PATCH",
    body: JSON.stringify({ username })
  });
  return res.json();
}

// ===== BOTS =====
export async function getBots() {
  const res = await fetchWithAuth("/bots");
  return res.json();
}

export async function deployBot(data: { phoneNumber?: string; botName?: string; sessionVar: string; isTrial?: boolean; device?: string; months?: number }) {
  const res = await fetchWithAuth("/bots/deploy", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function stopBot(id: string) {
  const res = await fetchWithAuth(`/bots/${id}/stop`, { method: "POST" });
  return res.json();
}

export async function startBot(id: string) {
  const res = await fetchWithAuth(`/bots/${id}/start`, { method: "POST" });
  return res.json();
}

export async function restartBot(id: string) {
  const res = await fetchWithAuth(`/bots/${id}/restart`, { method: "POST" });
  return res.json();
}

export async function renewBot(id: string, months: number) {
  const res = await fetchWithAuth(`/bots/${id}/renew`, {
    method: "POST",
    body: JSON.stringify({ months })
  });
  return res.json();
}

export async function deleteBot(id: string) {
  const res = await fetchWithAuth(`/bots/${id}/delete`, { method: "POST" });
  return res.json();
}

export async function getBotLogs(id: string) {
  const res = await fetchWithAuth(`/bots/${id}/logs`);
  return res.json();
}

export async function updateBotVars(id: string, session: string, device?: string, extraVars?: Record<string, string>) {
  const body: Record<string, unknown> = { session };
  if (device) body.device = device;
  if (extraVars && Object.keys(extraVars).length > 0) body.extraVars = extraVars;
  const res = await fetchWithAuth(`/bots/${id}/vars`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function checkTrial(phone: string) {
  const res = await fetchWithAuth(`/bots/trial-check/${phone}`);
  return res.json();
}

export async function getBotVars(id: string) {
  const res = await fetchWithAuth(`/bots/${id}/vars`);
  return res.json();
}

// ===== BOT TEMPLATES =====
export async function getBotTemplates() {
  const res = await fetchWithAuth("/bot-templates");
  return res.json();
}

export async function getBotTemplateBySlug(slug: string) {
  const res = await fetch(`${API_URL}/bot-templates/slug/${slug}`);
  return res.json();
}

export async function addBotTemplate(data: { name: string; githubRepo: string; sessionIdUrl: string; costTx: number }) {
  const res = await fetchWithAuth("/bot-templates", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deleteBotTemplate(id: string) {
  const res = await fetchWithAuth(`/bot-templates/${id}`, { method: "DELETE" });
  return res.json();
}

export async function refreshBotTemplateImage(id: string) {
  const res = await fetchWithAuth(`/bot-templates/${id}/refresh-image`, { method: "POST" });
  return res.json();
}

export async function getTemplateAppVars(templateId: string): Promise<{ vars: { key: string; description: string; required: boolean; value: string }[]; sessionIdUrl: string }> {
  const res = await fetchWithAuth(`/bots/template-appvars/${templateId}`);
  return res.json();
}

export async function deployBotWithTemplate(data: {
  botTemplateId: string;
  botName: string;
  sessionVar: string;
  device?: string;
  months?: number;
  extraVars?: Record<string, string>;
}) {
  const res = await fetchWithAuth("/bots/deploy-template", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

// ===== PAYMENTS =====
export async function getPackages() {
  const res = await fetch(`${API_URL}/payments/packages`);
  return res.json();
}

export async function initiatePayment(packageId: string) {
  const res = await fetchWithAuth("/payments/initiate", {
    method: "POST",
    body: JSON.stringify({ packageId })
  });
  return res.json();
}

export async function getTransactions() {
  const res = await fetchWithAuth("/payments/history");
  return res.json();
}

export async function verifyPayment(reference: string) {
  const res = await fetchWithAuth(`/payments/verify/${reference}`);
  return res.json();
}

export async function getMobileChargeStatus(reference: string) {
  const res = await fetchWithAuth(`/payments/charge/status/${reference}`);
  return res.json();
}

export async function initiateCustomPayment(ksAmount: number, txAmount: number) {
  const res = await fetchWithAuth("/payments/initiate-custom", {
    method: "POST",
    body: JSON.stringify({ ksAmount, txAmount })
  });
  return res.json();
}

export async function getPaymentHistory() {
  const res = await fetchWithAuth("/payments/history");
  return res.json();
}

// ===== TIGERPAY PRO (TANZANIA - AUTOMATIC) =====
export async function initiateTigerPayPayment(data: {
  amount: number;
  phone: string;
  network: "vodacom" | "airtel" | "tigo" | "halotel";
  packageId?: string;
  isCustom?: boolean;
  txAmount?: number;
}) {
  const res = await fetchWithAuth("/payments/tigerpay/initiate", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function checkTigerPayStatus(reference: string) {
  const res = await fetchWithAuth(`/payments/tigerpay/status/${reference}`);
  return res.json();
}

// ===== MIN PAY (INTERNATIONAL - MANUAL) =====
export async function requestMinPay(data: {
  packageId?: string;
  txAmount: number;
  ksAmount: number;
  username: string;
  email: string;
}) {
  const res = await fetchWithAuth("/payments/minpay/request", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getMinPayRequests() {
  const res = await fetchWithAuth("/payments/minpay/requests");
  return res.json();
}

export async function confirmMinPay(requestId: string) {
  const res = await fetchWithAuth(`/payments/minpay/confirm/${requestId}`, {
    method: "POST"
  });
  return res.json();
}

export async function rejectMinPay(requestId: string, reason?: string) {
  const res = await fetchWithAuth(`/payments/minpay/reject/${requestId}`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
  return res.json();
}

// ===== COUPONS =====
export async function claimCoupon(code: string) {
  const res = await fetchWithAuth("/coupons/claim", {
    method: "POST",
    body: JSON.stringify({ code })
  });
  return res.json();
}

// ===== ADMIN =====
export async function getAdminStats() {
  const res = await fetchWithAuth("/admin/stats");
  return res.json();
}

export async function getAdminUsers() {
  const res = await fetchWithAuth("/admin/users");
  return res.json();
}

export async function banUser(id: string, reason?: string) {
  const res = await fetchWithAuth(`/admin/users/${id}/ban`, {
    method: "POST",
    body: JSON.stringify({ reason })
  });
  return res.json();
}

export async function unbanUser(id: string) {
  const res = await fetchWithAuth(`/admin/users/${id}/unban`, { method: "POST" });
  return res.json();
}

export async function grantTx(id: string, amount: number) {
  const res = await fetchWithAuth(`/admin/users/${id}/tx`, {
    method: "POST",
    body: JSON.stringify({ amount })
  });
  return res.json();
}

export async function subtractTx(id: string, amount: number) {
  const res = await fetchWithAuth(`/admin/users/${id}/subtract-tx`, {
    method: "POST",
    body: JSON.stringify({ amount })
  });
  return res.json();
}

export async function resetPassword(id: string, password: string) {
  const res = await fetchWithAuth(`/admin/users/${id}/password`, {
    method: "POST",
    body: JSON.stringify({ password })
  });
  return res.json();
}

export async function deleteUser(id: string) {
  const res = await fetchWithAuth(`/admin/users/${id}`, { method: "DELETE" });
  return res.json();
}

export async function getAdminBots() {
  const res = await fetchWithAuth("/admin/bots");
  return res.json();
}

export async function getAdminTransactions() {
  const res = await fetchWithAuth("/admin/transactions");
  return res.json();
}

export async function getAdminCoupons() {
  const res = await fetchWithAuth("/admin/coupons");
  return res.json();
}

export async function createCoupon(code: string, txAmount: number) {
  const res = await fetchWithAuth("/admin/coupons", {
    method: "POST",
    body: JSON.stringify({ code, txAmount })
  });
  return res.json();
}

export async function deleteCoupon(id: string) {
  const res = await fetchWithAuth(`/admin/coupons/${id}`, { method: "DELETE" });
  return res.json();
}

export async function getAdminReferrals() {
  const res = await fetchWithAuth("/admin/referrals");
  return res.json();
}

export async function deleteAllAdminReferrals() {
  const res = await fetchWithAuth("/admin/referrals/all", { method: "DELETE" });
  return res.json();
}

export async function stopAdminBot(id: string) {
  const res = await fetchWithAuth(`/admin/bots/${id}/stop`, { method: "POST" });
  return res.json();
}

export async function startAdminBot(id: string) {
  const res = await fetchWithAuth(`/admin/bots/${id}/start`, { method: "POST" });
  return res.json();
}

export async function restartAdminBot(id: string) {
  const res = await fetchWithAuth(`/admin/bots/${id}/restart`, { method: "POST" });
  return res.json();
}

export async function deleteAdminBot(id: string) {
  const res = await fetchWithAuth(`/admin/bots/${id}`, { method: "DELETE" });
  return res.json();
}

export async function deleteAdminTransaction(id: string) {
  const res = await fetchWithAuth(`/admin/transactions/${id}`, { method: "DELETE" });
  return res.json();
}

export async function getAdminBotLogs(id: string) {
  const res = await fetchWithAuth(`/admin/bots/${id}/logs`);
  return res.json();
}

export async function getAdminTeams() {
  const res = await fetchWithAuth("/admin/teams");
  return res.json();
}

export async function createAdminTeam(name: string, billingLabel: string) {
  const res = await fetchWithAuth("/admin/teams", {
    method: "POST",
    body: JSON.stringify({ name, billingLabel })
  });
  return res.json();
}

export async function updateAdminTeam(id: string, billingLabel: string, active?: boolean) {
  const body: Record<string, unknown> = { billingLabel };
  if (typeof active === "boolean") body.active = active;
  const res = await fetchWithAuth(`/admin/teams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  return res.json();
}

export async function deleteAdminTeam(id: string) {
  const res = await fetchWithAuth(`/admin/teams/${id}`, { method: "DELETE" });
  return res.json();
}

export async function getAdminDbStats() {
  const res = await fetchWithAuth("/admin/db/stats");
  return res.json();
}

export async function purgeAdminCollection(collection: string) {
  const res = await fetchWithAuth(`/admin/db/purge/${collection}`, { method: "DELETE" });
  return res.json();
}

export async function getAdminPanelPlans() {
  const res = await fetchWithAuth("/panels/plans");
  return res.json();
}

export async function createAdminPanelPlan(data: {
  name: string;
  description: string;
  txCost: number;
  ram: string;
  disk: string;
  cpu: string;
  isBestDeal: boolean;
}) {
  const res = await fetchWithAuth("/panels/admin/plans", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deleteAdminPanelPlan(id: string) {
  const res = await fetchWithAuth(`/panels/admin/plans/${id}`, { method: "DELETE" });
  return res.json();
}

export async function getAdminAllPanels() {
  const res = await fetchWithAuth("/panels/admin/all");
  return res.json();
}

export async function getOrphanHerokuApps() {
  const res = await fetchWithAuth("/admin/orphan-apps");
  return res.json();
}

export async function deleteOrphanApp(appName: string) {
  const res = await fetchWithAuth(`/admin/orphan-apps/${encodeURIComponent(appName)}`, { method: "DELETE" });
  return res.json();
}

// ===== PANELS =====
export async function getPanelPlans() {
  const res = await fetch(`${API_URL}/panels/plans`);
  return res.json();
}

export async function getMyPanels() {
  const res = await fetchWithAuth("/panels/my");
  return res.json();
}

export async function purchasePanel(planId: string) {
  const res = await fetchWithAuth("/panels/purchase", {
    method: "POST",
    body: JSON.stringify({ planId })
  });
  return res.json();
}

export async function purchaseAdminPanel() {
  const res = await fetchWithAuth("/panels/purchase-admin", { method: "POST" });
  return res.json();
}

export async function getAdminPanels() {
  const res = await fetchWithAuth("/panels/admin/all");
  return res.json();
}

export async function deleteAdminPanel(id: string) {
  const res = await fetchWithAuth(`/panels/admin/panel/${id}`, { method: "DELETE" });
  return res.json();
}

export async function deletePanel(id: string) {
  const res = await fetchWithAuth(`/panels/my/${id}`, { method: "DELETE" });
  return res.json();
}

// ===== TUTORIALS =====
export async function getTutorials() {
  const res = await fetch(`${API_URL}/tutorials`);
  return res.json();
}

export async function getAdminTutorials() {
  const res = await fetchWithAuth("/admin/tutorials");
  return res.json();
}

export async function createAdminTutorial(data: { title: string; youtubeUrl: string; order?: number }) {
  const res = await fetchWithAuth("/admin/tutorials", {
    method: "POST",
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deleteAdminTutorial(id: string) {
  const res = await fetchWithAuth(`/admin/tutorials/${id}`, { method: "DELETE" });
  return res.json();
}

// ===== ADMIN TRANSACTIONS =====
export async function deleteAdminTransactionsBulk(ids: string[]) {
  const res = await fetchWithAuth("/admin/transactions/bulk", {
    method: "DELETE",
    body: JSON.stringify({ ids })
  });
  return res.json();
}

export async function resolveStaleTransactions() {
  const res = await fetchWithAuth("/admin/transactions/resolve-stale", { method: "POST" });
  return res.json();
}