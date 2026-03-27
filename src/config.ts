import { z } from "zod";
import type { ScoringRuleKey, ScoringWeights } from "./types.js";

const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  keyword: 60,
  budget: 20,
  beginnerFriendly: 25,
  lowCompetition: 15,
  clientRating: 15,
  clientJobCount: 10,
  deadlineMargin: 10,
  recency: 10,
  skillMatch: 20,
};

const VALID_RULE_KEYS = new Set<string>([
  "keyword",
  "budget",
  "beginnerFriendly",
  "lowCompetition",
  "clientRating",
  "clientJobCount",
  "deadlineMargin",
  "recency",
  "skillMatch",
]);

function parseScoringWeights(raw: string | undefined): ScoringWeights {
  if (!raw || raw.trim() === "") return { ...DEFAULT_SCORING_WEIGHTS };
  const weights: ScoringWeights = {};
  for (const entry of raw.split(",")) {
    const [key, val] = entry.split(":").map((s) => s.trim());
    if (VALID_RULE_KEYS.has(key) && !Number.isNaN(Number(val))) {
      weights[key as ScoringRuleKey] = Number(val);
    }
  }
  return weights;
}

const schema = z.object({
  DISCORD_WEBHOOK_URL: z.string().url().optional(),
  MIN_BUDGET_JPY: z.coerce.number().default(5000),
  KEYWORDS: z.string().default("Dify,ChatGPT,Python 自動化,TradingView,AI チャットボット,業務効率化"),
  MATCH_KEYWORDS: z.string().optional(),
  SKILLS: z.string().optional(),
  PREFER_BEGINNER_FRIENDLY: z
    .string()
    .optional()
    .transform((v) => (v ?? "true").toLowerCase() !== "false"),
  TOP_N: z.coerce.number().default(15),
  SCORING_WEIGHTS: z.string().optional(),
  LOW_COMPETITION_THRESHOLD: z.coerce.number().default(10),
  DEADLINE_MARGIN_DAYS: z.coerce.number().default(7),
  RECENCY_DAYS: z.coerce.number().default(3),
  MIN_CLIENT_RATING: z.coerce.number().default(4.0),
  MIN_CLIENT_JOB_COUNT: z.coerce.number().default(5),
  ENABLE_CROWDWORKS: z
    .string()
    .optional()
    .transform((v) => (v ?? "true").toLowerCase() !== "false"),
  ENABLE_LANCERS: z
    .string()
    .optional()
    .transform((v) => (v ?? "true").toLowerCase() !== "false"),
});

export type AppConfig = {
  discordWebhookUrl?: string;
  minBudgetJpy: number;
  keywords: string[];
  matchKeywords: string[];
  skills: string[];
  preferBeginnerFriendly: boolean;
  topN: number;
  scoringWeights: ScoringWeights;
  lowCompetitionThreshold: number;
  deadlineMarginDays: number;
  recencyDays: number;
  minClientRating: number;
  minClientJobCount: number;
  enableCrowdworks: boolean;
  enableLancers: boolean;
};

export function getConfig(): AppConfig {
  const parsed = schema.parse(process.env);
  return {
    discordWebhookUrl: parsed.DISCORD_WEBHOOK_URL,
    minBudgetJpy: parsed.MIN_BUDGET_JPY,
    keywords: parsed.KEYWORDS.split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    matchKeywords: (parsed.MATCH_KEYWORDS ?? parsed.KEYWORDS)
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    skills: (parsed.SKILLS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    preferBeginnerFriendly: parsed.PREFER_BEGINNER_FRIENDLY,
    topN: parsed.TOP_N,
    scoringWeights: parseScoringWeights(parsed.SCORING_WEIGHTS),
    lowCompetitionThreshold: parsed.LOW_COMPETITION_THRESHOLD,
    deadlineMarginDays: parsed.DEADLINE_MARGIN_DAYS,
    recencyDays: parsed.RECENCY_DAYS,
    minClientRating: parsed.MIN_CLIENT_RATING,
    minClientJobCount: parsed.MIN_CLIENT_JOB_COUNT,
    enableCrowdworks: parsed.ENABLE_CROWDWORKS,
    enableLancers: parsed.ENABLE_LANCERS,
  };
}
