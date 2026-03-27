import type { AppConfig } from "../config.js";
import type { NormalizedJob, ScoredJob, ScoringRuleKey } from "../types.js";

function includesAnyKeyword(text: string, keywords: string[]): string[] {
  const t = text.toLowerCase();
  return keywords.filter((k) => t.includes(k.toLowerCase()));
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

type RuleResult = { points: number; reason: string | null };

type RuleFn = (job: NormalizedJob, config: AppConfig, maxPts: number) => RuleResult;

const rules: Record<ScoringRuleKey, RuleFn> = {
  keyword(job, config, maxPts) {
    const text = `${job.title}\n${job.description ?? ""}`;
    const hits = includesAnyKeyword(text, config.matchKeywords);
    if (hits.length === 0) return { points: 0, reason: null };
    const points = Math.min(maxPts, hits.length * Math.ceil(maxPts / 3));
    return { points, reason: `keyword:${hits.join(",")}` };
  },

  budget(job, config, maxPts) {
    if (typeof job.price !== "number") return { points: 0, reason: null };
    if (job.price >= config.minBudgetJpy) {
      return { points: maxPts, reason: `budget>=${config.minBudgetJpy}` };
    }
    return { points: -Math.ceil(maxPts / 2), reason: null };
  },

  beginnerFriendly(job, config, maxPts) {
    if (!config.preferBeginnerFriendly) return { points: 0, reason: null };
    if (job.beginnerFriendly === true) {
      return { points: maxPts, reason: "初心者歓迎" };
    }
    return { points: 0, reason: null };
  },

  lowCompetition(job, config, maxPts) {
    if (typeof job.applicantCount !== "number") return { points: 0, reason: null };
    if (job.applicantCount <= config.lowCompetitionThreshold) {
      const ratio = 1 - job.applicantCount / Math.max(config.lowCompetitionThreshold, 1);
      const points = Math.round(maxPts * ratio);
      return { points, reason: `応募少(${job.applicantCount}件)` };
    }
    return { points: 0, reason: null };
  },

  clientRating(job, config, maxPts) {
    if (typeof job.clientRating !== "number") return { points: 0, reason: null };
    if (job.clientRating >= config.minClientRating) {
      const ratio = Math.min(1, job.clientRating / 5);
      const points = Math.round(maxPts * ratio);
      return { points, reason: `評価${job.clientRating}` };
    }
    return { points: 0, reason: null };
  },

  clientJobCount(job, config, maxPts) {
    if (typeof job.clientJobCount !== "number") return { points: 0, reason: null };
    if (job.clientJobCount >= config.minClientJobCount) {
      const points = Math.min(maxPts, Math.round(maxPts * Math.min(1, job.clientJobCount / 50)));
      return { points, reason: `発注実績${job.clientJobCount}件` };
    }
    return { points: 0, reason: null };
  },

  deadlineMargin(job, _config, maxPts) {
    if (!job.deadline) return { points: 0, reason: null };
    const deadline = new Date(job.deadline);
    if (Number.isNaN(deadline.getTime())) return { points: 0, reason: null };
    const margin = daysBetween(deadline, new Date());
    if (margin >= _config.deadlineMarginDays) {
      return { points: maxPts, reason: `締切余裕(${Math.floor(margin)}日)` };
    }
    if (margin >= 1) {
      const ratio = margin / _config.deadlineMarginDays;
      return { points: Math.round(maxPts * ratio), reason: `締切${Math.floor(margin)}日` };
    }
    return { points: -Math.ceil(maxPts / 2), reason: null };
  },

  recency(job, config, maxPts) {
    if (!job.postedAt) return { points: 0, reason: null };
    const posted = new Date(job.postedAt);
    if (Number.isNaN(posted.getTime())) return { points: 0, reason: null };
    const age = daysBetween(new Date(), posted);
    if (age <= config.recencyDays) {
      const ratio = 1 - age / config.recencyDays;
      const points = Math.round(maxPts * ratio);
      return { points, reason: `新着(${Math.floor(age)}日前)` };
    }
    return { points: 0, reason: null };
  },

  skillMatch(job, config, maxPts) {
    if (!job.skills || job.skills.length === 0 || config.skills.length === 0) {
      return { points: 0, reason: null };
    }
    const jobSkills = job.skills.map((s) => String(s).toLowerCase());
    const matched = config.skills.filter((s) =>
      jobSkills.some((js) => js.includes(s.toLowerCase())),
    );
    if (matched.length === 0) return { points: 0, reason: null };
    const ratio = Math.min(1, matched.length / config.skills.length);
    const points = Math.round(maxPts * ratio);
    return { points, reason: `skill:${matched.join(",")}` };
  },
};

export function scoreJobs(jobs: NormalizedJob[], config: AppConfig): ScoredJob[] {
  const weights = config.scoringWeights;

  return jobs
    .map((job) => {
      let score = 0;
      const reasons: string[] = [];

      for (const [key, maxPts] of Object.entries(weights)) {
        if (!maxPts || maxPts === 0) continue;
        const ruleFn = rules[key as ScoringRuleKey];
        if (!ruleFn) continue;

        const result = ruleFn(job, config, maxPts);
        score += result.points;
        if (result.reason) reasons.push(result.reason);
      }

      return { ...job, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}
