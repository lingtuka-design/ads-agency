import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../env";
import { requireAuth } from "../auth";
import { jsonBody, me } from "./helpers";
import type { AppBindings } from "./helpers";
import {
  detectLanguage,
  fetchMatches,
  parseFilters,
  runGemini,
  scoreMatch,
  type MatchCandidate,
} from "../services/gemini";
import { formatMoney } from "@agency/shared";

const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .optional(),
});

export const aiRoutes = new Hono<AppBindings>();
aiRoutes.use("*", requireAuth);

function fallbackResponse(
  user: { name: string },
  message: string,
  matches: MatchCandidate[],
  filters: ReturnType<typeof parseFilters>,
): string {
  const lang = detectLanguage(message);
  const lines: string[] = [];
  if (lang === "mizo") {
    lines.push(`Ni e, ${user.name} á¹­hianpu â€” kan publisher te chhuah a ni.`);
    lines.push("");
  } else {
    lines.push(`Hello ${user.name} â€” here's what I found for you.`);
    lines.push("");
  }

  if (matches.length === 0) {
    if (lang === "mizo") {
      lines.push("Rengpawh thianah pakhat nge ni leh? Ka hmuh chhuah te an awm lo a. I thupui kha sawi leh nawn rawh. (No matching packages found â€” tell me a bit more about your campaign.)");
    } else {
      lines.push("I couldn't find packages matching your criteria right now. Try adjusting your budget, platform, or audience â€” or tell me more about your campaign.");
    }
    lines.push("");
    lines.push("Need an advertisement itself? Our **Creative Studio** can design flyers, posters, and videos for you.");
    return lines.join("\n");
  }

  const limit = Math.min(3, matches.length);
  for (let i = 0; i < limit; i++) {
    const m = matches[i];
    const score = scoreMatch(m, filters);
    const price = formatMoney(m.price);
    if (lang === "mizo") {
      lines.push(`### ${i + 1}. ${m.publisherName}`);
      lines.push(`- Platform: ${m.platform} | Followers: ${m.followers.toLocaleString()}`);
      lines.push(`- Audience: ${m.primaryAgeGroup ?? "n/a"}${m.audienceLocation ? ` Â· ${m.audienceLocation}` : ""}${m.engagementRate != null ? ` Â· ${m.engagementRate}% engagement` : ""}`);
      lines.push(`- Package: **${m.packageTitle}** â€” **${price}**`);
      lines.push(`- Match score: ${score}% Â· ${m.availableSlots} slot(s) left`);
      lines.push("");
    } else {
      lines.push(`### Recommended Option ${i + 1}`);
      lines.push(`Publisher: **${m.publisherName}** â€” ${m.platform}`);
      lines.push(`Followers: ${m.followers.toLocaleString()}${m.primaryAgeGroup ? ` Â· Primary Audience: ${m.primaryAgeGroup}` : ""}${m.audienceLocation ? ` Â· Location: ${m.audienceLocation}` : ""}`);
      lines.push(`Package: **${m.packageTitle}** â€” **${price}** Â· ${m.availableSlots} slot(s) available`);
      lines.push(`Match Score: **${score}%**`);
      lines.push("");
    }
  }

  if (lang === "mizo") {
    lines.push("Hei hi in-book ve turin package page ah hian in rawn inkhai thei e. Advertisement nei lo maw? **Creative Studio** in in siamsak thei e.");
  } else {
    lines.push("You can book any of these directly from its package page. Don't have an advertisement yet? Our **Creative Studio** can create flyers, posters, and videos for you.");
  }
  return lines.join("\n");
}

aiRoutes.post("/chat", async (c) => {
  const user = me(c);
  const input = await jsonBody(chatSchema, c);

  const filters = parseFilters(input.message);
  const matches = await fetchMatches(c.env, filters);
  const ranked = matches
    .map((m) => ({ m, score: scoreMatch(m, filters) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((x) => x.m);

  const lang = detectLanguage(input.message);
  const context = {
    data: ranked.map((m) => ({
      publisherName: m.publisherName,
      packageTitle: m.packageTitle,
      price: m.price,
      platform: m.platform,
      followers: m.followers,
      primaryAgeGroup: m.primaryAgeGroup,
      audienceLocation: m.audienceLocation,
      engagementRate: m.engagementRate,
      availableSlots: m.availableSlots,
      slug: m.publisherSlug,
    })),
    note: "This is the ONLY data available. Never mention publishers or packages outside this list. Never invent prices or stats.",
  };

  const historyBlock = (input.history ?? [])
    .slice(-8)
    .map((h) => `${h.role}: ${h.content}`)
    .join("\n");

  const prompt = [
    `User: ${user.name} (role: ${user.role})`,
    `User message: ${input.message}`,
    "",
    "Available publisher/package data (facts only):",
    JSON.stringify(context.data),
    "",
    historyBlock ? `Conversation history:\n${historyBlock}` : "",
    "",
    "Respond as a professional advertising consultant. Detect the user's language (Mizo or English) and reply in it. Only use the facts above. If nothing matches, say so and ask clarifying questions. Use markdown. Keep it under 350 words.",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await runGemini(c.env, { prompt });
  const text = result.text || fallbackResponse({ name: user.name }, input.message, ranked, filters);
  return c.json({
    reply: text,
    language: lang,
    used_fallback: result.usedFallback || !result.text,
    matches: ranked.map((m) => ({
      publisher: m.publisherName,
      package: m.packageTitle,
      price: m.price,
      platform: m.platform,
      score: scoreMatch(m, filters),
      link: `/publishers/${m.publisherSlug}`,
    })),
  });
});

aiRoutes.get("/health", async (c) => {
  return c.json({ ok: true, gemini_configured: !!c.env.GEMINI_API_KEY });
});
