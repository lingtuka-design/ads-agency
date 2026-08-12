import type { Env } from "../env";

export interface GeminiRequest {
  prompt: string;
}

export interface GeminiResponse {
  text: string;
  usedFallback: boolean;
}

const MIZO_MARKERS = [
  "ngai", "ka duh", "duh", "awm", "kha", "kumkhuah", "thiam", "sawi", "tan", "bawihchhia", "engtin",
  "chhuak", "chang", "tam", "zawng", "nia", "em", "mai", "aiin", "khawvel", "a nih", "ka", "chhe",
  "hril", "hmang", "inpui", "vawng", "tih", "thawh", "nghah", "tih lan",
];

export function detectLanguage(text: string): "mizo" | "english" | "mixed" {
  const lower = text.toLowerCase();
  let mizo = 0;
  for (const m of MIZO_MARKERS) {
    if (lower.includes(m)) mizo++;
    if (mizo >= 3) return "mizo";
  }
  return "english";
}

export function systemInstruction(): string {
  return [
    "You are the Advertising Assistant for an advertising agency marketplace.",
    "You are a professional advertising consultant, not a generic chatbot.",
    "You help advertisers find publishers, packages, and campaigns.",
    "IMPORTANT RULES:",
    "1. ONLY recommend publishers and packages that appear in the PROVIDED DATA.",
    "2. NEVER invent prices, follower counts, availability, audience data, publisher names, or package details.",
    "3. If information is unavailable, say so clearly.",
    "4. If the user speaks Mizo, reply in Mizo. If English, reply in English. Detect from the user message.",
    "5. Be concise, structured, and helpful. Use markdown.",
    "6. Guide users toward booking: they can open the package page to book.",
    "7. If they need creative help, mention the Creative Studio design request service.",
  ].join("\n");
}

/** Deterministic match scoring used by both Gemini prompt and fallback (spec §77). */
export function scoreMatch(pkg: MatchCandidate, filters: ParsedFilters): number {
  let score = 50;
  if (filters.maxBudget != null) {
    if (pkg.price <= filters.maxBudget) score += 25;
    else score -= (pkg.price / filters.maxBudget - 1) * 30;
  }
  if (filters.platforms && filters.platforms.length > 0) {
    score += filters.platforms.includes(pkg.platform) ? 15 : -15;
  }
  if (filters.age && pkg.primaryAgeGroup) {
    const m = filters.age.match(/(\d+)/);
    const p = pkg.primaryAgeGroup.match(/(\d+)/);
    if (m && p && Math.abs(parseInt(m[1], 10) - parseInt(p[1], 10)) <= 6) score += 10;
  }
  if (filters.location && pkg.audienceLocation) {
    const a = filters.location.toLowerCase();
    const b = pkg.audienceLocation.toLowerCase();
    if (b.includes(a) || a.includes(b)) score += 10;
  }
  score += Math.min(10, pkg.engagementRate ? pkg.engagementRate : 0);
  score += Math.min(5, Math.log10(pkg.followers + 1) * 0.8);
  return Math.max(0, Math.min(100, Math.round(score)));
}

export interface MatchCandidate {
  packageId: string;
  packageTitle: string;
  price: number;
  platform: string;
  publisherId: string;
  publisherName: string;
  publisherSlug: string;
  followers: number;
  primaryAgeGroup: string | null;
  audienceLocation: string | null;
  engagementRate: number | null;
  availableSlots: number;
  totalSlots: number;
}

export interface ParsedFilters {
  maxBudget?: number;
  durationDays?: number;
  platforms?: string[];
  age?: string;
  location?: string;
  keywords?: string;
}

const PLATFORM_KEYWORDS: Record<string, string[]> = {
  INSTAGRAM: ["instagram", "ig", "story", "reel"],
  FACEBOOK: ["facebook", "fb"],
  YOUTUBE: ["youtube", "video", "shorts", "channel"],
  WEBSITE: ["website", "web", "banner", "news site"],
  NEWSPAPER: ["newspaper", "paper"],
  TELEVISION: ["television", "tv", "channel"],
};

export function parseFilters(text: string): ParsedFilters {
  const filters: ParsedFilters = {};
  const lower = text.toLowerCase();
  const budgetM = lower.match(/(?:rs\.?\s?|₹|inr\s?)([\d,]+(?:\.\d+)?)\s*k?/i);
  if (budgetM) {
    let n = parseFloat(budgetM[1].replace(/,/g, ""));
    if (/k/i.test(budgetM[0])) n *= 1000;
    filters.maxBudget = n;
  }
  const durationM = lower.match(/(\d+)\s*(?:month|months|day|days|week|weeks)/);
  if (durationM) {
    const n = parseInt(durationM[1], 10);
    const unit = durationM[0].includes("month") ? 30 : durationM[0].includes("week") ? 7 : 1;
    filters.durationDays = n * unit;
  }
  const ageM = lower.match(/(\d{1,2})\s*[-–to]+\s*(\d{1,2})/);
  if (ageM) filters.age = `${ageM[1]}-${ageM[2]}`;
  for (const [platform, keywords] of Object.entries(PLATFORM_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      filters.platforms = [...(filters.platforms ?? []), platform];
    }
  }
  const locM = lower.match(/\b(mizoram|mizo|aizawl|assam|shillong|guwahati|kolkata|delhi|mumbai|india)\b/);
  if (locM) filters.location = locM[1];
  filters.keywords = lower;
  return filters;
}

export async function fetchMatches(env: Env, filters: ParsedFilters): Promise<MatchCandidate[]> {
  const base = `
    SELECT p.id AS packageId, p.title AS packageTitle, p.price, p.platform,
           pu.id AS publisherId, pu.name AS publisherName, pu.slug AS publisherSlug,
           COALESCE(s.followers, 0) AS followers,
           s.primary_age_group AS primaryAgeGroup,
           s.audience_location AS audienceLocation,
           s.engagement_rate AS engagementRate,
           (p.total_slots - p.booked_slots - p.reserved_slots) AS availableSlots,
           p.total_slots AS totalSlots
    FROM ad_packages p
    JOIN publishers pu ON pu.id = p.publisher_id
    LEFT JOIN publisher_stats s ON s.publisher_id = pu.id
    WHERE p.is_active = 1 AND pu.status IN ('APPROVED','ACTIVE')
      AND (p.total_slots - p.booked_slots - p.reserved_slots) > 0`;

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.platforms && filters.platforms.length > 0) {
    clauses.push(`p.platform IN (${filters.platforms.map(() => "?").join(",")})`);
    params.push(...filters.platforms);
  }
  if (filters.location) {
    clauses.push(`s.audience_location IS NOT NULL AND LOWER(s.audience_location) LIKE ?`);
    params.push(`%${filters.location.toLowerCase()}%`);
  }
  const where = clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
  const rows = await env.DB.prepare(`${base}${where} ORDER BY p.price ASC LIMIT 50`).bind(...params).all<
    Omit<MatchCandidate, "primaryAgeGroup" | "audienceLocation"> & { primaryAgeGroup: string | null; audienceLocation: string | null }
  >();
  return rows.results;
}

export async function runGemini(env: Env, request: GeminiRequest): Promise<GeminiResponse> {
  const key = env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL ?? "gemini-1.5-flash";
  if (!key) {
    return { text: "", usedFallback: true };
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction() }] },
          contents: [{ role: "user", parts: [{ text: request.prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
      },
    );
    if (!res.ok) return { text: "", usedFallback: true };
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return { text, usedFallback: false };
  } catch {
    return { text: "", usedFallback: true };
  }
}
