/**
 * Demo data seeder — populates the marketplace with realistic example data (spec §84).
 *
 * Prerequisite: `wrangler dev` running (npm run dev:worker), then:
 *   npm run db:seed
 *
 * Demo accounts:
 *   Admin:      lingtuka / MAWLA1984@mala  (bootstrap, must change password)
 *   Advertiser: demo.advertiser@agency.test / demo1234
 *   Publishers: demo.*@agency.test / demo1234 (5 publishers, approved + verified)
 */
import { randomUUID } from "node:crypto";

const BASE = process.env.SEED_API ?? "http://127.0.0.1:8787";
const DEMO_PASSWORD = "demo1234";

const jar: Record<string, string> = {};
let adminCookie = "";

async function api(path: string, opts: { method?: string; body?: unknown; cookie?: string } = {}): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const cookie = opts.cookie ?? jar[path.startsWith("/api/auth") ? "current" : Object.values(jar)[0] ?? ""];
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

interface PublisherSpec {
  email: string;
  name: string;
  platform: string;
  followers: number;
  avgReach: number | null;
  engagement: number | null;
  location: string;
  ageGroup: string;
  description: string;
  packages: { title: string; price: number; qty: number; days: number; slots: number; specs: Record<string, unknown>; desc: string }[];
}

const PUBLISHERS: PublisherSpec[] = [
  {
    email: "demo.influencer@agency.test",
    name: "Mizo Vibes Media",
    platform: "INSTAGRAM",
    followers: 185000,
    avgReach: 2400000,
    engagement: 8.4,
    location: "Aizawl, Mizoram",
    ageGroup: "18-34",
    description: "Mizoram's largest entertainment & lifestyle Instagram page. Stories, reels and feed posts with high youth engagement.",
    packages: [
      { title: "1 Instagram Story", price: 1500, qty: 1, days: 7, slots: 30, specs: { dimensions: "1080x1920", formats: ["jpg", "png", "mp4"], maxSizeMB: 10 }, desc: "Single story, 24 hours live." },
      { title: "5 Instagram Stories", price: 6000, qty: 5, days: 30, slots: 12, specs: { dimensions: "1080x1920", formats: ["jpg", "png", "mp4"], maxSizeMB: 10 }, desc: "5 stories across the month." },
      { title: "10 Instagram Stories / Month", price: 10000, qty: 10, days: 30, slots: 8, specs: { dimensions: "1080x1920", formats: ["jpg", "png", "mp4"], maxSizeMB: 10 }, desc: "Best value monthly package with boosted reach." },
      { title: "Feed Post + 3 Stories", price: 8000, qty: 4, days: 14, slots: 10, specs: { dimensions: "1080x1350", formats: ["jpg", "png"], maxSizeMB: 10 }, desc: "One feed post pinned with three stories." },
      { title: "Reel Promotion", price: 12000, qty: 1, days: 14, slots: 6, specs: { dimensions: "1080x1920", formats: ["mp4"], maxSizeMB: 100 }, desc: "Dedicated reel with boosted reach." },
    ],
  },
  {
    email: "demo.youtube@agency.test",
    name: "Mizoram Tech Channel",
    platform: "YOUTUBE",
    followers: 84000,
    avgReach: 120000,
    engagement: 6.1,
    location: "Mizoram",
    ageGroup: "18-40",
    description: "Tech reviews and tutorials in Mizo language. Trusted channel with a loyal subscriber base.",
    packages: [
      { title: "2 YouTube Shorts", price: 15000, qty: 2, days: 30, slots: 6, specs: { dimensions: "1080x1920", formats: ["mp4"], maxSizeMB: 100 }, desc: "Two shorts featuring your brand." },
      { title: "Video Sponsorship (30s)", price: 25000, qty: 1, days: 30, slots: 4, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "30-second sponsored segment in a regular video." },
      { title: "Community Post", price: 5000, qty: 1, days: 7, slots: 10, specs: { formats: ["jpg", "png"], maxSizeMB: 10 }, desc: "Community tab post with link." },
      { title: "Dedicated Video Review", price: 45000, qty: 1, days: 45, slots: 3, specs: { formats: ["mp4"], maxSizeMB: 100 }, desc: "Full dedicated review video of your product." },
    ],
  },
  {
    email: "demo.news@agency.test",
    name: "Mizoram News Daily",
    platform: "WEBSITE",
    followers: 0,
    avgReach: 950000,
    engagement: null,
    location: "Aizawl, Mizoram",
    ageGroup: "25-55",
    description: "Leading news website in Mizoram with 950K monthly visitors. Banner and sponsored article placements.",
    packages: [
      { title: "Homepage Banner (7 days)", price: 8000, qty: 7, days: 7, slots: 12, specs: { dimensions: "1200x300", formats: ["jpg", "png", "gif"], maxSizeMB: 5 }, desc: "Top banner on the homepage." },
      { title: "Sidebar Banner (30 days)", price: 12000, qty: 30, days: 30, slots: 8, specs: { dimensions: "300x250", formats: ["jpg", "png"], maxSizeMB: 5 }, desc: "Sidebar display for a month." },
      { title: "Sponsored Article", price: 20000, qty: 1, days: 30, slots: 5, specs: { formats: ["pdf"], maxSizeMB: 10 }, desc: "Editorial-style sponsored article." },
      { title: "Homepage Takeover (1 day)", price: 30000, qty: 1, days: 1, slots: 4, specs: { dimensions: "1920x1080", formats: ["jpg", "png"], maxSizeMB: 10 }, desc: "Full homepage takeover for one day." },
    ],
  },
  {
    email: "demo.paper@agency.test",
    name: "Mizoram Herald",
    platform: "NEWSPAPER",
    followers: 0,
    avgReach: 500000,
    engagement: null,
    location: "Aizawl, Mizoram",
    ageGroup: "30-65",
    description: "Print and digital newspaper with half-page and full-page advertising across Mizoram.",
    packages: [
      { title: "Quarter Page Ad", price: 6000, qty: 1, days: 1, slots: 10, specs: { dimensions: "18x12cm", formats: ["pdf", "jpg"], maxSizeMB: 20 }, desc: "Quarter page print ad." },
      { title: "Half Page Ad", price: 12000, qty: 1, days: 1, slots: 8, specs: { dimensions: "18x26cm", formats: ["pdf", "jpg"], maxSizeMB: 20 }, desc: "Half page print ad." },
      { title: "Front Page Ad (half)", price: 25000, qty: 1, days: 1, slots: 4, specs: { dimensions: "18x13cm", formats: ["pdf", "jpg"], maxSizeMB: 20 }, desc: "Premium front page placement." },
      { title: "Full Page Ad", price: 22000, qty: 1, days: 1, slots: 6, specs: { dimensions: "36x52cm", formats: ["pdf", "jpg"], maxSizeMB: 20 }, desc: "Full page print ad." },
    ],
  },
  {
    email: "demo.fb@agency.test",
    name: "Mizoram Community Page",
    platform: "FACEBOOK",
    followers: 220000,
    avgReach: 3100000,
    engagement: 7.2,
    location: "Mizoram",
    ageGroup: "18-45",
    description: "Community news and lifestyle page with 220K followers and massive monthly reach.",
    packages: [
      { title: "Facebook Post", price: 4000, qty: 1, days: 7, slots: 20, specs: { dimensions: "1200x630", formats: ["jpg", "png", "mp4"], maxSizeMB: 10 }, desc: "Single promoted post." },
      { title: "Facebook Story (10)", price: 7000, qty: 10, days: 30, slots: 10, specs: { dimensions: "1080x1920", formats: ["jpg", "png", "mp4"], maxSizeMB: 10 }, desc: "10 stories across the month." },
      { title: "Pinned Post (7 days)", price: 9000, qty: 1, days: 7, slots: 8, specs: { dimensions: "1200x630", formats: ["jpg", "png"], maxSizeMB: 10 }, desc: "Pinned post for 7 days." },
      { title: "Monthly Promotion Package", price: 18000, qty: 4, days: 30, slots: 6, specs: { dimensions: "1200x630", formats: ["jpg", "png", "mp4"], maxSizeMB: 10 }, desc: "4 posts + 10 stories for the month." },
    ],
  },
];

async function main() {
  console.log("Seeding demo data against", BASE);

  // 1. Bootstrap + login admin
  await api("/api/auth/bootstrap", { method: "POST" });
  adminCookie = await loginAs("lingtuka", "MAWLA1984@mala");
  console.log("[admin] logged in");

  // 2. Demo advertiser
  await api("/api/auth/register", {
    method: "POST",
    body: {
      name: "Demo Advertiser",
      email: "demo.advertiser@agency.test",
      password: DEMO_PASSWORD,
      role: "advertiser",
      companyName: "Lucky Clothing Store",
      industry: "Retail & Fashion",
      location: "Aizawl, Mizoram",
    },
  }).catch(() => console.log("[advertiser] already exists"));
  console.log("[advertiser] demo.advertiser@agency.test / " + DEMO_PASSWORD);

  // 3. Publishers
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
    }).catch(() => {
      /* already exists — continue */
    });
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
        category: spec.platform === "INSTAGRAM" ? "Influencer" : spec.platform === "YOUTUBE" ? "YouTube Channel" : spec.platform === "WEBSITE" ? "News Website" : spec.platform === "NEWSPAPER" ? "Newspaper" : "Media Page",
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

  // 4. A demo completed campaign + review + settlement for Mizo Vibes Media
  try {
    const advCookie = await loginAs("demo.advertiser@agency.test", DEMO_PASSWORD);
    const pubCookie = await loginAs(PUBLISHERS[0].email, DEMO_PASSWORD);
    const pubMe = await api("/api/auth/me", { cookie: pubCookie });
    const pubId = pubMe.user.publisher_id;
    const packages = await api("/api/publishers/me/packages", { cookie: pubCookie });
    const pkg = packages.find((p: { title: string }) => p.title === "10 Instagram Stories / Month");

    const booking = await api("/api/bookings", {
      method: "POST",
      cookie: advCookie,
      body: {
        campaign: {
          name: "Lucky Clothing — Festive Launch",
          objective: "BRAND_AWARENESS",
          product_service: "Festive clothing collection",
          target_audience: "Youth 18-34 in Mizoram",
          start_date: new Date(Date.now() - 40 * 86400000).toISOString().slice(0, 10),
          end_date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10),
        },
        package_ids: [pkg.id],
        instructions: "Highlight the 30% launch discount and WhatsApp number.",
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
      body: { file_url: "https://dummyimage.com/1080x1920/6366f1/ffffff&text=Lucky+Clothing", file_name: "lucky-festive-flyer.jpg", file_size: 245000, mime_type: "image/jpeg" },
    });

    // Run the campaign to completion
    for (const [to, note] of [
      ["CREATIVE_APPROVED", "Creative approved by agency"],
      ["SENT_TO_PUBLISHER", "Sent to publisher"],
      ["PUBLISHER_APPROVED", "Publisher accepted"],
      ["SCHEDULED", "Scheduled"],
      ["LIVE", "Published"],
      ["PROOF_SUBMITTED", "Proof: screenshot uploaded"],
      ["COMPLETED", "Campaign completed"],
    ] as const) {
      const actor = to === "PUBLISHER_APPROVED" || to === "LIVE" || to === "PROOF_SUBMITTED" ? pubCookie : adminCookie;
      await api(`/api/bookings/${bookingId}/transition`, {
        method: "POST",
        cookie: actor,
        body: { to, note },
      });
    }

    // Settlement
    await api("/api/settlements", {
      method: "POST",
      cookie: adminCookie,
      body: { publisher_id: pubId, booking_ids: [bookingId], method: "BANK_TRANSFER", notes: "Demo settlement" },
    });
    const settlements = await api("/api/settlements", { cookie: adminCookie });
    const settlement = settlements.find((s: { amount: number }) => s.amount === 9000);
    if (settlement) {
      await api(`/api/settlements/${settlement.id}/pay`, {
        method: "POST",
        cookie: adminCookie,
        body: { status: "PAID", payout_ref: "DEMO-NEFT-001", notes: "Paid via demo" },
      });
    }

    // Review
    await api("/api/reviews", {
      method: "POST",
      cookie: advCookie,
      body: { booking_id: bookingId, communication: 5, reliability: 5, execution: 4, comment: "Excellent reach and communication. Would recommend!" },
    });
    console.log("[demo] completed campaign + settlement + review created");
  } catch (e) {
    console.log("[demo] optional campaign skipped:", (e as Error).message.slice(0, 160));
  }

  console.log("\nSeed complete.");
  console.log("  Admin:      lingtuka / MAWLA1984@mala");
  console.log("  Advertiser: demo.advertiser@agency.test / " + DEMO_PASSWORD);
  console.log("  Publishers: demo.*@agency.test / " + DEMO_PASSWORD);
}

main().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
