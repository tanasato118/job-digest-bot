import * as cheerio from "cheerio";
import type { AppConfig } from "../config.js";
import type { NormalizedJob } from "../types.js";

const BASE_URL = "https://www.lancers.jp";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
  "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
};

async function fetchSearchPage(keyword: string): Promise<string> {
  const url = `${BASE_URL}/work/search?keyword=${encodeURIComponent(keyword)}&sort=started`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Lancers fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function parsePrice(
  $: ReturnType<typeof cheerio.load>,
  priceEl: ReturnType<ReturnType<typeof cheerio.load>>,
): { min: number | null; max: number | null } {
  const numbers = priceEl
    .find(".p-search-job-media__number")
    .map((_, el) => {
      const raw = $(el).text().replace(/,/g, "").trim();
      return Number.isNaN(Number(raw)) ? null : Number(raw);
    })
    .get()
    .filter((n): n is number => n !== null);

  return {
    min: numbers[0] ?? null,
    max: numbers[1] ?? numbers[0] ?? null,
  };
}

function parseJobCards(html: string): NormalizedJob[] {
  const $ = cheerio.load(html);
  const jobs: NormalizedJob[] = [];

  $(".c-media").each((_, card) => {
    const $card = $(card);

    // Skip ended listings
    const statusText = $card
      .find(".p-search-job-media__time-text")
      .text()
      .trim();
    if (statusText === "募集終了") return;

    // Title & URL
    const titleEl = $card.find(
      "a.p-search-job-media__title, a.c-media__title",
    );
    // Clean title: remove child elements' text (badges like NEW, 2回目, etc.)
    const titleClone = titleEl.clone();
    titleClone.children().remove();
    const title = titleClone.text().trim().replace(/\s+/g, " ");
    const href = titleEl.attr("href");
    if (!title || !href) return;
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    // Price
    const priceEl = $card.find(".p-search-job-media__price");
    const { min: priceMin, max: priceMax } = parsePrice($, priceEl);
    const price = priceMax ?? priceMin;

    // Job type (プロジェクト, タスク, etc.)
    const jobType =
      $card.find(".c-badge__text").first().text().trim() || undefined;

    // Category
    const category =
      $card.find(".p-search-job__division-link").first().text().trim() ||
      undefined;

    // Description
    const descEls = $card.find(".c-media__description");
    let description = "";
    descEls.each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 50) description = text;
    });

    // Tags (初心者歓迎, カンタン, etc.)
    const tags: string[] = [];
    $card.find(".p-search-job-media__tag-list").each((_, el) => {
      tags.push($(el).text().trim());
    });
    const beginnerFriendly =
      tags.some((t) => t.includes("カンタン") || t.includes("初心者")) || null;

    // Applicant count
    let applicantCount: number | null = null;
    const proposeNumbers = $card
      .find(".p-search-job-media__propose-number")
      .map((_, el) => $(el).text().trim())
      .get();
    if (proposeNumbers.length >= 1) {
      const won = Number(proposeNumbers[0]);
      if (!Number.isNaN(won)) applicantCount = won;
    }

    //募集人数
    let recruitCount: number | null = null;
    if (proposeNumbers.length >= 2) {
      const rc = Number(proposeNumbers[1]);
      if (!Number.isNaN(rc)) recruitCount = rc;
    }

    jobs.push({
      source: "lancers",
      title,
      url,
      price,
      currency: "JPY",
      deadline: null,
      applicantCount,
      beginnerFriendly,
      description: description || undefined,
      category,
      jobType,
      skills: tags.length > 0 ? tags : undefined,
      clientRating: null,
      clientJobCount: null,
      postedAt: null,
    });
  });

  return jobs;
}

export async function fetchLancersJobs(
  config: AppConfig,
): Promise<NormalizedJob[]> {
  const allJobs: NormalizedJob[] = [];
  const seen = new Set<string>();

  for (const keyword of config.keywords) {
    try {
      const html = await fetchSearchPage(keyword);
      const jobs = parseJobCards(html);
      for (const job of jobs) {
        if (!seen.has(job.url)) {
          seen.add(job.url);
          // Only tag with keywords actually present in title/description
          const text = `${job.title} ${job.description ?? ""}`.toLowerCase();
          job.matchedKeywords = config.keywords.filter((k) =>
            text.includes(k.toLowerCase()),
          );
          allJobs.push(job);
        }
      }
      console.log(`  [lancers] "${keyword}" -> ${jobs.length} jobs`);
    } catch (err) {
      console.error(`  [lancers] "${keyword}" error:`, err);
    }
  }

  console.log(`  [lancers] total unique: ${allJobs.length}`);
  return allJobs;
}
