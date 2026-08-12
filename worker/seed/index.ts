/**
 * Demo data seeder — replaces ALL demo publishers/advertisers with the
 * official roster below. Run against local dev or the live Cloudflare site.
 *
 * Prerequisite: worker running (local: `npm run dev:worker`, or use SEED_API).
 *   Local:  npm run db:seed
 *   Remote: $env:SEED_API="https://ad-agency-marketplace.inkhel.workers.dev"; npm run db:seed
 *
 * Passwords are the same for every demo account: demo1234
 */
import { randomUUID } from "node:crypto";

const BASE = process.env.SEED_API ?? "http://127.0.0.1:8787";
const DEMO_PASSWORD = "demo1234";

const jar: Record<string, string> = {};

async function api(path: string, opts: { method?: string; body?: unknown; cookie?: string } = {}): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const cookie = opts.cookie ?? jar.current;
  if (cookie) headers.Cookie = "session=" + cookie;
  const res = await fetch(BASE + path, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const t = setCookie.split(";")[0].split("=")[1];
    if (t) jar.current = t;
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${opts.method ?? "GET"} ${path} -> ${res.status}: ${JSON.stringify(body)?.slice(0, 300)}`);
  return body;
}

async function loginAs(email: string, password: string) {
  await api("/api/auth/login", { method: "POST", body: { email, password } });
  return jar.current;
}

interface PackageSpec {
  title: string;
  price: number;
  qty: number;
  days: number;
  slots: number;
  specs: Record<string, unknown>;
  desc: string;
}

interface PublisherSpec {
  email: string;
  name: string;
  platform: string;
  category: string;
  description: string;
  followers: number;
  subscribers?: number | null;
  monthlyVisitors?: number | null;
  monthlyPageViews?: number | null;
  avgReach: number | null;
  engagement: number | null;
  location: string;
  ageGroup: string;
  packages: PackageSpec[];
}

const PUBLISHERS: PublisherSpec[] = [
  {
    email: "vanglaini@agency.test",
    name: "Vanglaini",
    platform: "NEWSPAPER",
    category: "Newspaper",
    description:
      "Mizoram's largest daily newspaper. Trusted print journalism reaching readers across every district — from Lunglei to Champhai — plus a growing digital edition.",
    followers: 0,
    monthlyVisitors: 250_000,
    avgReach: 120_000,
    engagement: null,
    location: "Aizawl, Mizoram",
    ageGroup: "25-65",
    packages: [
      { title: "Quarter Page Ad", price: 4500, qty: 1, days: 1, slots: 12, specs: { dimensions: "18x12cm", formats: ["pdf", "jpg"], maxSizeMB: 20 }, desc: "Quarter page print advertisement." },
      { title: "Half Page Ad", price: 8500, qty: 1, days: 1, slots: 10, specs: { dimensions: "18x26cm", formats: ["pdf", "jpg"], maxSizeMB: 20 }, desc: "Half page print advertisement." },
      { title: "Full Page Ad", price: 15000, qty: 1, days: 1, slots: 8, specs: { dimensions: "36x52cm", formats: ["pdf", "jpg"], maxSizeMB: 20 }, desc: "Full page print advertisement." },
      { title: "Front Page Half Ad", price: 22000, qty: 1, days: 1, slots: 5, specs: { dimensions: "18x13cm", formats: ["pdf", "jpg"], maxSizeMB: 20 }, desc: "Premium front page placement." },
      { title: "Back Page Ad", price: 18000, qty: 1, days: 1, slots: 6, specs: { dimensions: "36x26cm", formats: ["pdf", "jpg"], maxSizeMB: 20 }, desc: "High-visibility back page ad." },
    ],
  },
  {
    email: "zonet@agency.test",
    name: "Zonet",
    platform: "TELEVISION",
    category: "Local TV Channel",
    description:
      "Mizoram's leading local television network. Live news, entertainment and community programming watched by households across the state.",
    followers: 0,
    subscribers: null,
    monthlyVisitors: 400_000,
    avgReach: 320_000,
    engagement: null,
    location: "Aizawl, Mizoram",
    ageGroup: "15-65",
    packages: [
      { title: "10-second Advertisement", price: 3500, qty: 1, days: 1, slots: 20, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "10-second TV spot." },
      { title: "20-second Advertisement", price: 5500, qty: 1, days: 1, slots: 15, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "20-second TV spot." },
      { title: "30-second Advertisement", price: 7500, qty: 1, days: 1, slots: 12, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "30-second TV spot." },
      { title: "Prime Time Package", price: 15000, qty: 5, days: 7, slots: 6, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "5 spots in prime time slots." },
      { title: "Sponsorship Package", price: 25000, qty: 12, days: 30, slots: 4, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "12 spots across a month with sponsor mention." },
    ],
  },
  {
    email: "lps@agency.test",
    name: "LPS",
    platform: "TELEVISION",
    category: "Local TV Channel",
    description:
      "Aizawl's favourite local television channel. Music, culture, sports and community shows with strong family viewership.",
    followers: 0,
    monthlyVisitors: 250_000,
    avgReach: 200_000,
    engagement: null,
    location: "Aizawl, Mizoram",
    ageGroup: "15-60",
    packages: [
      { title: "10-second Advertisement", price: 2500, qty: 1, days: 1, slots: 20, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "10-second TV spot." },
      { title: "20-second Advertisement", price: 4000, qty: 1, days: 1, slots: 15, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "20-second TV spot." },
      { title: "30-second Advertisement", price: 6000, qty: 1, days: 1, slots: 12, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "30-second TV spot." },
      { title: "Prime Time 30s", price: 10000, qty: 1, days: 1, slots: 8, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "Prime time 30-second spot." },
      { title: "Event Sponsorship", price: 18000, qty: 1, days: 30, slots: 5, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "Event sponsorship with multiple mentions." },
    ],
  },
  {
    email: "inkhel@agency.test",
    name: "inkhel",
    platform: "WEBSITE",
    category: "News & Portal Website",
    description:
      "Aizawl's fast-growing news and lifestyle portal. Clean layout, engaged readers and powerful banner placements for local brands.",
    followers: 0,
    monthlyVisitors: 180_000,
    monthlyPageViews: 520_000,
    avgReach: 150_000,
    engagement: null,
    location: "Aizawl, Mizoram",
    ageGroup: "18-50",
    packages: [
      { title: "Homepage Banner (7 days)", price: 4000, qty: 7, days: 7, slots: 15, specs: { dimensions: "1200x300", formats: ["jpg", "png", "gif"], maxSizeMB: 5 }, desc: "Top banner on the homepage." },
      { title: "Sidebar Banner (30 days)", price: 7000, qty: 30, days: 30, slots: 10, specs: { dimensions: "300x250", formats: ["jpg", "png"], maxSizeMB: 5 }, desc: "Sidebar display for a month." },
      { title: "Article Banner", price: 3000, qty: 7, days: 7, slots: 20, specs: { dimensions: "728x90", formats: ["jpg", "png"], maxSizeMB: 5 }, desc: "Banner inside article pages." },
      { title: "Popup Ad (30 days)", price: 5500, qty: 30, days: 30, slots: 12, specs: { dimensions: "400x300", formats: ["jpg", "png"], maxSizeMB: 5 }, desc: "Attention-grabbing popup ad." },
      { title: "Sponsored Article", price: 9000, qty: 1, days: 30, slots: 8, specs: { formats: ["pdf", "docx"], maxSizeMB: 10 }, desc: "Editorial-style sponsored article." },
    ],
  },
  {
    email: "zirapc@agency.test",
    name: "ZiraPC",
    platform: "YOUTUBE",
    category: "YouTube Channel",
    description:
      "Mizoram's biggest tech & entertainment YouTuber. Reviews, vlogs and unboxings in Mizo — with a hugely loyal subscriber base.",
    followers: 0,
    subscribers: 350_000,
    monthlyVisitors: 1_900_000,
    avgReach: 480_000,
    engagement: 9.5,
    location: "Mizoram",
    ageGroup: "16-40",
    packages: [
      { title: "Video Sponsorship (30s)", price: 15000, qty: 1, days: 30, slots: 8, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "30-second sponsored segment in a regular video." },
      { title: "2 YouTube Shorts", price: 12000, qty: 2, days: 30, slots: 10, specs: { dimensions: "1080x1920", formats: ["mp4"], maxSizeMB: 100 }, desc: "Two shorts featuring your brand." },
      { title: "Community Post", price: 3500, qty: 1, days: 7, slots: 15, specs: { formats: ["jpg", "png"], maxSizeMB: 10 }, desc: "Community tab post with link." },
      { title: "Video Integration", price: 18000, qty: 1, days: 30, slots: 6, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "Brand integrated throughout a video." },
      { title: "Dedicated Video Review", price: 45000, qty: 1, days: 45, slots: 3, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "Full dedicated review video of your product." },
    ],
  },
  {
    email: "zofooty@agency.test",
    name: "Zofooty",
    platform: "INSTAGRAM",
    category: "Influencer",
    description:
      "Mizoram's most influential Instagram page. Stories, reels and posts with enormous daily reach and the highest engagement on the platform.",
    followers: 210_000,
    avgReach: 1_400_000,
    engagement: 7.8,
    location: "Aizawl, Mizoram",
    ageGroup: "18-34",
    packages: [
      { title: "1 Instagram Story", price: 1800, qty: 1, days: 7, slots: 30, specs: { dimensions: "1080x1920", formats: ["jpg", "png", "mp4"], maxSizeMB: 10 }, desc: "Single story, 24 hours live." },
      { title: "5 Instagram Stories", price: 7000, qty: 5, days: 30, slots: 12, specs: { dimensions: "1080x1920", formats: ["jpg", "png", "mp4"], maxSizeMB: 10 }, desc: "5 stories across the month." },
      { title: "10 Instagram Stories", price: 12000, qty: 10, days: 30, slots: 8, specs: { dimensions: "1080x1920", formats: ["jpg", "png", "mp4"], maxSizeMB: 10 }, desc: "Best value monthly story package." },
      { title: "Reel Promotion", price: 10000, qty: 1, days: 14, slots: 8, specs: { dimensions: "1080x1920", formats: ["mp4"], maxSizeMB: 100 }, desc: "Dedicated reel with boosted reach." },
      { title: "Feed Post + 3 Stories", price: 9500, qty: 4, days: 14, slots: 10, specs: { dimensions: "1080x1350", formats: ["jpg", "png"], maxSizeMB: 10 }, desc: "One feed post with three stories." },
    ],
  },
  {
    email: "aizawlpost@agency.test",
    name: "Aizawl Post",
    platform: "NEWSPAPER",
    category: "Newspaper",
    description:
      "Aizawl's leading English-language newspaper. Quality journalism with strong urban readership and corporate advertising.",
    followers: 0,
    monthlyVisitors: 90_000,
    avgReach: 45_000,
    engagement: null,
    location: "Aizawl, Mizoram",
    ageGroup: "25-60",
    packages: [
      { title: "Quarter Page Ad", price: 3500, qty: 1, days: 1, slots: 10, specs: { dimensions: "18x12cm", formats: ["pdf", "jpg"], maxSizeMB: 20 }, desc: "Quarter page print ad." },
      { title: "Half Page Ad", price: 7000, qty: 1, days: 1, slots: 8, specs: { dimensions: "18x26cm", formats: ["pdf", "jpg"], maxSizeMB: 20 }, desc: "Half page print ad." },
      { title: "Full Page Ad", price: 12000, qty: 1, days: 1, slots: 6, specs: { dimensions: "36x52cm", formats: ["pdf", "jpg"], maxSizeMB: 20 }, desc: "Full page print ad." },
      { title: "Front Page Ad", price: 18000, qty: 1, days: 1, slots: 4, specs: { dimensions: "18x26cm", formats: ["pdf", "jpg"], maxSizeMB: 20 }, desc: "Front page placement." },
      { title: "Classified Banner", price: 2500, qty: 1, days: 3, slots: 20, specs: { dimensions: "12x8cm", formats: ["jpg", "png"], maxSizeMB: 10 }, desc: "Classified banner section ad." },
    ],
  },
];

const ADVERTISERS: { email: string; name: string; company: string; industry: string; location: string; description: string }[] = [
  { email: "adidas@agency.test", name: "Adidas Mizoram", company: "Adidas Mizoram", industry: "Retail & Fashion", location: "Aizawl, Mizoram", description: "Official Adidas retailer — footwear, apparel and accessories." },
  { email: "musicinn@agency.test", name: "Music Inn", company: "Music Inn", industry: "Music & Audio", location: "Aizawl, Mizoram", description: "Aizawl's music hub — instruments, sound systems and audio gear." },
  { email: "kimkim@agency.test", name: "Kimkim Sofa", company: "Kimkim Sofa", industry: "Furniture & Home", location: "Aizawl, Mizoram", description: "Handcrafted sofas and home furniture made in Mizoram." },
  { email: "orient@agency.test", name: "Orient Goldsmith", company: "Orient Goldsmith", industry: "Jewellery & Gifts", location: "Aizawl, Mizoram", description: "Trusted gold and jewellery house serving Mizoram for generations." },
];

/**
 * Reset: remove ALL existing demo publishers and advertisers (and their data)
 * so the marketplace always mirrors this seed exactly (spec §84: demo data is
 * clearly replaceable, never mixed with production).
 */
async function resetDemoAccounts(adminCookie: string) {
  console.log("[reset] removing existing demo publishers & advertisers…");
  const childrenFirst = [
    "settlement_items", "settlements", "disputes", "reviews", "publisher_reviews_aggregate",
    "creative_versions", "creatives",
    "invoices", "payment_events", "payments", "booking_status_history", "bookings",
    "campaigns", "favorites", "messages", "ad_packages", "publisher_stats",
    "publisher_payout_info", "publishers", "advertisers",
  ];
  const stmts = childrenFirst.map((t) => `DELETE FROM ${t};`);
  stmts.push(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE role IN ('publisher','advertiser'));`);
  stmts.push(`DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE role IN ('publisher','advertiser'));`);
  stmts.push(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE role IN ('publisher','advertiser'));`);
  stmts.push(`DELETE FROM users WHERE role IN ('publisher','advertiser');`);
  const res = await fetch(BASE + "/api/admin/db/reset-demo", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: "session=" + adminCookie },
    body: JSON.stringify({ statements: stmts }),
  });
  if (!res.ok) throw new Error(`reset failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  console.log("[reset] done.");
}

async function main() {
  console.log("Seeding demo data against", BASE);

  // 1. Bootstrap + login admin
  await api("/api/auth/bootstrap", { method: "POST" });
  const adminCookie = await loginAs("lingtuka", "MAWLA1984@mala");
  console.log("[admin] logged in");

  // 2. Wipe existing demo accounts
  await resetDemoAccounts(adminCookie);

  // 3. Advertisers
  for (const spec of ADVERTISERS) {
    await api("/api/auth/register", {
      method: "POST",
      body: {
        name: spec.name,
        email: spec.email,
        password: DEMO_PASSWORD,
        role: "advertiser",
        companyName: spec.company,
        industry: spec.industry,
        location: spec.location,
      },
    }).catch(() => { /* already exists */ });
    await loginAs(spec.email, DEMO_PASSWORD);
    await api("/api/users/me", {
      method: "PATCH",
      body: { name: spec.name },
    }).catch(() => {});
    console.log(`[advertiser] ${spec.company} — ${spec.email} / ${DEMO_PASSWORD}`);
  }

  // 4. Publishers
  for (const spec of PUBLISHERS) {
    await api("/api/auth/register", {
      method: "POST",
      body: {
        name: spec.name,
        email: spec.email,
        password: DEMO_PASSWORD,
        role: "publisher",
        publisherName: spec.name,
        location: spec.location,
      },
    }).catch(() => { /* already exists */ });
    const pubCookie = await loginAs(spec.email, DEMO_PASSWORD);
    const me = await api("/api/auth/me", { cookie: pubCookie });
    const pubId = me.user.publisher_id;

    // Admin: approve + verify + feature FIRST (packages require approval)
    await api(`/api/admin/publishers/${pubId}/decision`, {
      method: "POST",
      cookie: adminCookie,
      body: { status: "ACTIVE", trust_level: "VERIFIED", featured: true, reason: "Demo publisher — verified by seed" },
    });

    await api("/api/publishers/me", {
      method: "PATCH",
      cookie: pubCookie,
      body: {
        description: spec.description,
        category: spec.category,
        location: spec.location,
        contact_email: spec.email,
      },
    });
    await api("/api/publishers/me/stats", {
      method: "PUT",
      cookie: pubCookie,
      body: {
        platform: spec.platform,
        platform_url: `https://example.com/${spec.name.toLowerCase().replace(/[^a-z]+/g, "")}`,
        followers: spec.followers,
        subscribers: spec.subscribers ?? null,
        monthly_visitors: spec.monthlyVisitors ?? null,
        monthly_page_views: spec.monthlyPageViews ?? null,
        avg_reach: spec.avgReach,
        engagement_rate: spec.engagement,
        audience_location: spec.location.split(",")[0] ?? spec.location,
        primary_age_group: spec.ageGroup,
        gender_distribution: { male: 52, female: 46, other: 2 },
      },
    });
    for (const pkg of spec.packages) {
      await api("/api/publishers/me/packages", {
        method: "POST",
        cookie: pubCookie,
        body: {
          title: pkg.title,
          platform: spec.platform,
          description: pkg.desc,
          price: pkg.price,
          quantity: pkg.qty,
          duration_days: pkg.days,
          total_slots: pkg.slots,
          creative_specs: pkg.specs,
          requirements: "Creative must be delivered at least 48h before scheduled publication.",
        },
      });
    }
    console.log(`[publisher] ${spec.name} — ${spec.packages.length} packages, approved & verified`);
  }

  // 5. Demo completed campaign: Adidas Mizoram × Zofooty (10 Stories)
  try {
    const advCookie = await loginAs("adidas@agency.test", DEMO_PASSWORD);
    const pubCookie = await loginAs("zofooty@agency.test", DEMO_PASSWORD);
    const pubMe = await api("/api/auth/me", { cookie: pubCookie });
    const pubId = pubMe.user.publisher_id;
    const packages = await api("/api/publishers/me/packages", { cookie: pubCookie });
    const pkg = packages.find((p: { title: string }) => p.title === "10 Instagram Stories");

    const booking = await api("/api/bookings", {
      method: "POST",
      cookie: advCookie,
      body: {
        campaign: {
          name: "Adidas Mizoram — Sneaker Launch",
          objective: "BRAND_AWARENESS",
          product_service: "New sneaker collection",
          target_audience: "Youth 18-34 in Mizoram",
          start_date: new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10),
          end_date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10),
        },
        package_ids: [pkg.id],
        instructions: "Highlight the launch discount and the store's WhatsApp number.",
      },
    });
    const bookingId = booking.bookings[0].booking_id;

    const checkout = await api("/api/payments/checkout", {
      method: "POST",
      cookie: advCookie,
      body: { booking_ids: [bookingId], method: "UPI" },
    });
    await api("/api/payments/confirm", { method: "POST", cookie: advCookie, body: { ref: checkout.client_payload.ref } });

    await api(`/api/creatives/booking/${bookingId}/upload`, {
      method: "POST",
      cookie: advCookie,
      body: { file_url: "https://dummyimage.com/1080x1920/6366f1/ffffff&text=Adidas+Mizoram", file_name: "adidas-launch-story.jpg", file_size: 245000, mime_type: "image/jpeg" },
    });

    for (const [to, note] of [
      ["CREATIVE_APPROVED", "Creative approved by agency"],
      ["SENT_TO_PUBLISHER", "Sent to publisher"],
      ["PUBLISHER_APPROVED", "Publisher accepted"],
      ["SCHEDULED", "Scheduled"],
      ["LIVE", "Published"],
      ["PROOF_SUBMITTED", "Proof: story screenshot uploaded"],
      ["COMPLETED", "Campaign completed"],
    ] as const) {
      const actor = to === "PUBLISHER_APPROVED" || to === "LIVE" || to === "PROOF_SUBMITTED" ? pubCookie : adminCookie;
      await api(`/api/bookings/${bookingId}/transition`, {
        method: "POST",
        cookie: actor,
        body: { to, note },
      });
    }

    // Settlement to Zofooty (₹12,000 → 10% commission → ₹10,800)
    await api("/api/settlements", {
      method: "POST",
      cookie: adminCookie,
      body: { publisher_id: pubId, booking_ids: [bookingId], method: "BANK_TRANSFER", notes: "Demo settlement" },
    });
    const settlements = await api("/api/settlements", { cookie: adminCookie });
    const settlement = settlements.find((s: { amount: number }) => s.amount === 10800);
    if (settlement) {
      await api(`/api/settlements/${settlement.id}/pay`, {
        method: "POST",
        cookie: adminCookie,
        body: { status: "PAID", payout_ref: "DEMO-NEFT-001", notes: "Paid via demo" },
      });
    }

    await api("/api/reviews", {
      method: "POST",
      cookie: advCookie,
      body: { booking_id: bookingId, communication: 5, reliability: 5, execution: 5, comment: "Outstanding reach on stories — highly recommended!" },
    });
    console.log("[demo] completed campaign (Adidas Mizoram × Zofooty) + settlement + review created");
  } catch (e) {
    console.log("[demo] optional campaign skipped:", (e as Error).message.slice(0, 160));
  }

  console.log("\nSeed complete.");
  console.log("  Admin:       lingtuka / MAWLA1984@mala");
  console.log("  Advertisers: " + ADVERTISERS.map((a) => `${a.email}`).join(", ") + " / " + DEMO_PASSWORD);
  console.log("  Publishers:  " + PUBLISHERS.map((p) => `${p.email}`).join(", ") + " / " + DEMO_PASSWORD);
}

main().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
