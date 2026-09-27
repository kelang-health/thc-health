import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const VERSION = "1.0.0-prep";
const MAX_BODY_BYTES = 24_576;
const SITE_KEY = "thc_health.site";
const HOURS_KEY = "thc_health.office_hours";
const PROD_KEY = "thc_health.production";
const CONTENT_TYPES = new Set(["WebsiteNews", "WebsiteAnnouncement"]);
const loginRate = new Map<string, number[]>();
const ALLOWED_ORIGINS = new Set([
  "https://line-service-hub.pages.dev",
  "https://kelang-health.github.io",
  "https://thc-health-stage.rounded-age.workers.dev",
  "http://127.0.0.1",
  "http://localhost",
]);

const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

type Profile = {
  id: string;
  admin_id: string | null;
  display_name: string | null;
  role: "ADMIN" | "STAFF";
  active: boolean;
};

function headers(req: Request): Headers {
  const h = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Vary": "Origin",
  });
  const origin = req.headers.get("origin") ?? "";
  if (ALLOWED_ORIGINS.has(origin)) {
    h.set("Access-Control-Allow-Origin", origin);
    h.set("Access-Control-Allow-Headers", "content-type, authorization");
    h.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  return h;
}
function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: headers(req) });
}
function fail(req: Request, message: string, status = 400): Response {
  return json(req, { success: false, error: message }, status);
}
function loginAllowed(req: Request): boolean {
  const key = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "unknown";
  const now = Date.now();
  const recent = (loginRate.get(key) ?? []).filter(t => now - t < 600_000);
  if (recent.length >= 5) return false;
  recent.push(now);
  loginRate.set(key, recent);
  return true;
}

function clearLoginRate(req: Request) {
  const key = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "unknown";
  loginRate.delete(key);
}

function clean(v: unknown, max = 500): string {
  return String(v ?? "").trim().slice(0, max);
}
function bool(v: unknown): boolean { return v === true; }
function safeUrl(v: unknown, max = 500): string {
  const value = clean(v, max);
  if (!value) return "";
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? value : "";
  } catch { return ""; }
}
function hhmm(v: unknown, fallback: string): string {
  const value = clean(v, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}
function isoDates(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(x => clean(x, 10)).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)))].slice(0, 100);
}
function weekdays(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map(Number).filter(x => Number.isInteger(x) && x >= 1 && x <= 7))].sort();
}

async function resolveLoginEmail(login: string): Promise<string> {
  if (login.includes("@")) return login;
  const { data: profile } = await service.from("profiles").select("id").eq("admin_id", login).maybeSingle();
  if (!profile?.id) return "";
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) return "";
    const found = data.users.find(user => user.id === profile.id);
    if (found?.email) return found.email;
    if (data.users.length < 100) break;
  }
  return "";
}
async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await service
    .from("profiles")
    .select("id,admin_id,display_name,role,active")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data?.active || !["ADMIN", "STAFF"].includes(data.role)) return null;
  return data as Profile;
}
async function authenticate(token: string): Promise<Profile | null> {
  if (!token) return null;
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return null;
  return await getProfile(data.user.id);
}
function publicProfile(p: Profile) {
  return { adminId: p.admin_id ?? "", displayName: p.display_name ?? p.admin_id ?? "ผู้ใช้งาน", role: p.role };
}

async function loadSettings() {
  const { data, error } = await service
    .from("system_settings")
    .select("setting_key,setting_value")
    .in("setting_key", [SITE_KEY, HOURS_KEY, PROD_KEY]);
  if (error) throw error;
  const map = Object.fromEntries((data ?? []).map((r: any) => [r.setting_key, r.setting_value ?? {}]));
  return {
    site: map[SITE_KEY] ?? {},
    schedule: map[HOURS_KEY] ?? { confirmed: false, timezone: "Asia/Bangkok", weekdays: [], holidays: [], closures: [] },
    production: map[PROD_KEY] ?? {},
  };
}
async function loadPublicContent(includeInactive = false) {
  let q = service
    .from("public_content")
    .select("id,content_type,value1,value2,active,sort_order,created_at,updated_at")
    .in("content_type", [...CONTENT_TYPES])
    .order("sort_order", { ascending: true })
    .order("id", { ascending: false })
    .limit(includeInactive ? 100 : 10);
  if (!includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
function readiness(site: any, schedule: any, production: any) {
  const checks = {
    identity: Boolean(site?.unit_name && site?.municipality),
    oneStopUrl: /^https:\/\//.test(String(site?.one_stop_url || "")),
    lineContact: /^https:\/\//.test(String(site?.line_contact_url || "")),
    officeHoursConfirmed: schedule?.confirmed === true,
    adminE2E: Boolean(production?.admin_e2e_passed_at),
    repoCreated: String(production?.target_repo || "") === "kelang-health/thc-health" && Boolean(production?.repo_created_at),
  };
  return {
    checks,
    readyToDeploy: Object.values(checks).every(Boolean),
    goLiveApproved: production?.go_live_approved === true,
    productionUrlConfigured: /^https:\/\//.test(String(production?.production_url || "")),
  };
}

async function publicPayload() {
  const [{ site, schedule, production }, news] = await Promise.all([loadSettings(), loadPublicContent(false)]);
  return {
    success: true,
    project: "thc-health",
    version: VERSION,
    systemStatus: "ok",
    site,
    schedule,
    readiness: readiness(site, schedule, production),
    news: news.slice(0, 3),
    generatedAt: new Date().toISOString(),
  };
}

function normalizeSite(body: Record<string, unknown>) {
  return {
    unit_name: clean(body.unit_name, 160),
    municipality: clean(body.municipality, 160),
    tagline: clean(body.tagline, 240),
    one_stop_url: safeUrl(body.one_stop_url),
    line_contact_url: safeUrl(body.line_contact_url),
    phone: clean(body.phone, 50),
    address: clean(body.address, 300),
    map_url: safeUrl(body.map_url),
  };
}
function normalizeHours(body: Record<string, unknown>) {
  return {
    timezone: clean(body.timezone, 80) || "Asia/Bangkok",
    weekdays: weekdays(body.weekdays),
    start: hhmm(body.start, "08:30"),
    end: hhmm(body.end, "16:30"),
    holidays: isoDates(body.holidays),
    closures: isoDates(body.closures),
    confirmed: bool(body.confirmed),
  };
}

async function upsertSetting(key: string, value: unknown, profile: Profile) {
  const { error } = await service.from("system_settings").upsert({
    setting_key: key,
    setting_value: value,
    description: key === SITE_KEY
      ? "THC Health public website configuration; non-secret"
      : "THC Health office hours and closure configuration; non-secret",
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "setting_key" });
  if (error) throw error;
}

async function handlePost(req: Request): Promise<Response> {
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) return fail(req, "คำขอมีขนาดใหญ่เกินกำหนด", 413);
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return fail(req, "คำขอมีขนาดใหญ่เกินกำหนด", 413);

  let body: Record<string, unknown>;
  try { body = raw ? JSON.parse(raw) : {}; } catch { return fail(req, "รูปแบบคำขอไม่ถูกต้อง"); }
  const action = clean(body.action, 40);

  if (action === "login") {
    if (!loginAllowed(req)) return fail(req, "เข้าสู่ระบบผิดซ้ำหลายครั้ง กรุณารอประมาณ 10 นาที", 429);
    const login = clean(body.username, 200).toLowerCase();
    const password = clean(body.password, 200);
    const email = await resolveLoginEmail(login);
    if (!email || !password) return fail(req, "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง", 401);
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user) return fail(req, "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง", 401);
    const profile = await getProfile(data.user.id);
    if (!profile) return fail(req, "บัญชีนี้ไม่ได้รับอนุญาตให้ใช้งาน", 403);
    clearLoginRate(req);
    return json(req, { success: true, token: data.session.access_token, expiresAt: data.session.expires_at, profile: publicProfile(profile) });
  }

  const token = clean(body.token, 4096) || clean(req.headers.get("authorization")?.replace(/^Bearer\s+/i, ""), 4096);
  const profile = await authenticate(token);
  if (!profile) return fail(req, "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", 401);

  if (action === "admin-load") {
    const [{ site, schedule, production }, content] = await Promise.all([loadSettings(), loadPublicContent(true)]);
    return json(req, { success: true, profile: publicProfile(profile), site, schedule, production, readiness: readiness(site, schedule, production), content });
  }

  if (profile.role !== "ADMIN") return fail(req, "เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขข้อมูลเว็บไซต์ได้", 403);

  if (action === "save-site") {
    const site = normalizeSite((body.site ?? {}) as Record<string, unknown>);
    if (!site.unit_name || !site.municipality) return fail(req, "กรุณาระบุชื่อหน่วยบริการและหน่วยงาน");
    await upsertSetting(SITE_KEY, site, profile);
    return json(req, { success: true, site });
  }

  if (action === "save-hours") {
    const schedule = normalizeHours((body.schedule ?? {}) as Record<string, unknown>);
    if (!schedule.weekdays.length) return fail(req, "กรุณาเลือกวันทำการอย่างน้อย 1 วัน");
    if (schedule.start >= schedule.end) return fail(req, "เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด");
    await upsertSetting(HOURS_KEY, schedule, profile);
    return json(req, { success: true, schedule });
  }

  if (action === "save-content") {
    const item = (body.item ?? {}) as Record<string, unknown>;
    const contentType = clean(item.content_type, 40);
    if (!CONTENT_TYPES.has(contentType)) return fail(req, "ประเภทเนื้อหาไม่ถูกต้อง");
    const title = clean(item.value1, 200);
    const summary = clean(item.value2, 1200);
    if (!title) return fail(req, "กรุณาระบุหัวข้อ");
    const record = {
      content_type: contentType,
      value1: title,
      value2: summary,
      active: item.active !== false,
      sort_order: Math.max(0, Math.min(9999, Number(item.sort_order ?? 100) || 100)),
      updated_at: new Date().toISOString(),
    };
    const id = Number(item.id || 0);
    if (id > 0) {
      const { data, error } = await service.from("public_content").update(record).eq("id", id).in("content_type", [...CONTENT_TYPES]).select("id").maybeSingle();
      if (error || !data?.id) return fail(req, "ไม่สามารถแก้ไขรายการได้", 404);
      return json(req, { success: true, id: data.id });
    }
    const { data, error } = await service.from("public_content").insert(record).select("id").single();
    if (error) throw error;
    return json(req, { success: true, id: data.id });
  }

  if (action === "set-content-active") {
    const id = Number(body.id || 0);
    if (!id) return fail(req, "รหัสรายการไม่ถูกต้อง");
    const { data, error } = await service
      .from("public_content")
      .update({ active: bool(body.active), updated_at: new Date().toISOString() })
      .eq("id", id)
      .in("content_type", [...CONTENT_TYPES])
      .select("id")
      .maybeSingle();
    if (error || !data?.id) return fail(req, "ไม่พบรายการที่แก้ไข", 404);
    return json(req, { success: true, id: data.id, active: bool(body.active) });
  }

  return fail(req, "ไม่พบคำสั่งที่ร้องขอ", 404);
}

Deno.serve(async (req: Request) => {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) return fail(req, "Cloud configuration ไม่พร้อม", 503);
  const origin = req.headers.get("origin") ?? "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) return fail(req, "Origin ไม่ได้รับอนุญาต", 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(req) });
  if (req.method === "POST") {
    try { return await handlePost(req); } catch { return fail(req, "ไม่สามารถดำเนินการได้ในขณะนี้", 503); }
  }
  if (req.method !== "GET") return fail(req, "Method not allowed", 405);

  const url = new URL(req.url);
  if (url.searchParams.get("api") === "health") return json(req, { status: "ok", service: "thc-health-api", version: VERSION });
  if (url.searchParams.get("api") === "readiness") {
    try {
      const { site, schedule, production } = await loadSettings();
      return json(req, { success: true, project: "thc-health", version: VERSION, readiness: readiness(site, schedule, production) });
    } catch { return fail(req, "ไม่สามารถตรวจความพร้อมได้ในขณะนี้", 503); }
  }
  if (url.searchParams.get("api") === "public") {
    try { return json(req, await publicPayload()); } catch { return fail(req, "ไม่สามารถโหลดข้อมูลเว็บไซต์ได้ในขณะนี้", 503); }
  }
  return json(req, { status: "ok", service: "thc-health-api", version: VERSION, stage: true });
});