import * as cheerio from "cheerio";
import type { AppConfig } from "../config.js";
import type { NormalizedJob } from "../types.js";

const BASE_URL = "https://crowdworks.jp";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
  "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
};

type CwPayment = {
  fixed_price_payment?: { min_budget: number; max_budget: number };
  fixed_price_writing_payment?: {
    article_price: number;
  };
  hourly_payment?: { min_hourly_wage: number; max_hourly_wage: number };
  competition_payment?: { min_budget?: number; max_budget?: number; price?: number };
  task_payment?: { price?: number };
};

type CwEntry = {
  project_entry?: {
    num_contracts: number;
    project_contract_hope_number: number;
  };
  competition_entry?: { num_entries?: number };
  task_entry?: { num_completed?: number };
};

type CwJobItem = {
  job_offer: {
    id: number;
    title: string;
    description_digest?: string;
    category_id?: number;
    genre?: string;
    skills?: string[];
    status?: string;
    expired_on?: string;
    last_released_at?: string;
  };
  payment: CwPayment;
  entry: CwEntry;
  client: {
    user_id: number;
    username: string;
    is_employer_certification?: boolean;
  };
};

function extractPrice(payment: CwPayment): number | null {
  if (payment.fixed_price_payment) {
    return payment.fixed_price_payment.max_budget || payment.fixed_price_payment.min_budget || null;
  }
  if (payment.fixed_price_writing_payment) {
    return payment.fixed_price_writing_payment.article_price || null;
  }
  if (payment.hourly_payment) {
    return payment.hourly_payment.max_hourly_wage || payment.hourly_payment.min_hourly_wage || null;
  }
  if (payment.competition_payment) {
    return payment.competition_payment.price ?? payment.competition_payment.max_budget ?? null;
  }
  if (payment.task_payment) {
    return payment.task_payment.price ?? null;
  }
  return null;
}

function extractApplicantCount(entry: CwEntry): number | null {
  if (entry.project_entry) return entry.project_entry.num_contracts;
  if (entry.competition_entry) return entry.competition_entry.num_entries ?? null;
  if (entry.task_entry) return entry.task_entry.num_completed ?? null;
  return null;
}

function extractJobType(payment: CwPayment): string | undefined {
  if (payment.fixed_price_payment) return "プロジェクト(固定)";
  if (payment.fixed_price_writing_payment) return "ライティング";
  if (payment.hourly_payment) return "時給制";
  if (payment.competition_payment) return "コンペ";
  if (payment.task_payment) return "タスク";
  return undefined;
}

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k.toLowerCase()));
}

export async function fetchCrowdworksJobs(
  config: AppConfig,
): Promise<NormalizedJob[]> {
  // CrowdWorks embeds job data in a Vue data attribute (same 50 jobs regardless of keyword).
  // We fetch once and filter by keywords locally.
  const url = `${BASE_URL}/public/jobs/search?order=new`;
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      throw new Error(`CrowdWorks fetch failed: ${res.status}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const dataAttr = $("[data]").attr("data");
    if (!dataAttr) {
      console.error("  [crowdworks] No data attribute found");
      return [];
    }
    const data = JSON.parse(dataAttr);
    const items: CwJobItem[] = data.searchResult?.job_offers ?? [];

    const jobs: NormalizedJob[] = [];
    for (const item of items) {
      const jo = item.job_offer;
      if (jo.status !== "released") continue;

      const searchText = `${jo.title} ${jo.description_digest ?? ""}`;
      if (!matchesKeywords(searchText, config.keywords)) continue;

      jobs.push({
        source: "crowdworks",
        title: jo.title,
        url: `${BASE_URL}/public/jobs/${jo.id}`,
        price: extractPrice(item.payment),
        currency: "JPY",
        deadline: jo.expired_on ?? null,
        applicantCount: extractApplicantCount(item.entry),
        beginnerFriendly: null,
        description: jo.description_digest,
        category: jo.genre ?? undefined,
        jobType: extractJobType(item.payment),
        skills: jo.skills && jo.skills.length > 0 ? jo.skills : undefined,
        clientRating: null,
        clientJobCount: null,
        postedAt: jo.last_released_at ?? null,
      });
    }

    console.log(`  [crowdworks] ${items.length} fetched, ${jobs.length} matched keywords`);
    return jobs;
  } catch (err) {
    console.error("  [crowdworks] error:", err);
    return [];
  }
}
