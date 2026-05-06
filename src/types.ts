export type JobSource = "crowdworks" | "lancers" | "coconala";

export interface NormalizedJob {
  source: JobSource;
  title: string;
  url: string;
  price: number | null;
  currency: string;
  deadline: string | null;
  applicantCount: number | null;
  beginnerFriendly: boolean | null;
  description?: string;
  category?: string;
  jobType?: string;
  skills?: string[];
  clientRating?: number | null;
  clientJobCount?: number | null;
  postedAt?: string | null;
  matchedKeywords?: string[];
}

export interface ScoredJob extends NormalizedJob {
  score: number;
  reasons: string[];
}

export type ScoringRuleKey =
  | "keyword"
  | "budget"
  | "beginnerFriendly"
  | "lowCompetition"
  | "clientRating"
  | "clientJobCount"
  | "deadlineMargin"
  | "recency"
  | "skillMatch";

export type ScoringWeights = Partial<Record<ScoringRuleKey, number>>;
