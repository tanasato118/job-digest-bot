import * as cheerio from "cheerio";
import type { AppConfig } from "../config.js";
import type { NormalizedJob } from "../types.js";

const BASE_URL = "https://coconala.com";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
  "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
};

async function fetchSearchPage(keyword: string): Promise<string> {
  const url = `${BASE_URL}/requests/search?keyword=${encodeURIComponent(keyword)}&order=new`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) {
    throw new Error(`Coconala fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function parsePrice(text: string): number | null {
  // Match patterns like "〜5,000円" "3,000〜10,000円" "5000円"
  const matches = text.replace(/,/g, "").match(/\d+/g);
  if (!matches) return null;
  const numbers = matches.map(Number).filter((n) => !Number.isNaN(n));
  // Return the max value found
  return numbers.length > 0 ? Math.max(...numbers) : null;
}

function parseJobCards(html: string): NormalizedJob[] {
  const $ = cheerio.load(html);
  const jobs: NormalizedJob[] = [];

  // Coconala request cards: try multiple possible selectors
  const cardSelectors = [
    ".p-request-list__item",
    ".c-request-card",
    "[class*='request-card']",
    "[class*='RequestCard']",
    "li[class*='request']",
  ];

  let cards = $();
  for (const sel of cardSelectors) {
    const found = $(sel);
    if (found.length > 0) {
      cards = found;
      break;
    }
  }

  if (cards.length === 0) {
    // Fallback: look for any article or li that contains a link to /requests/
    $("article, li").each((_, el) => {
      if ($(el).find("a[href*='/requests/']").length > 0) {
        cards = cards.add(el);
      }
    });
  }

  cards.each((_, card) => {
    const $card = $(card);

    // Title & URL
    const titleEl = $card.find("a[href*='/requests/']").first();
    const title = titleEl.text().trim().replace(/\s+/g, " ");
    const href = titleEl.attr("href");
    if (!title || !href) return;
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    // Price — look for yen amounts
    const priceText = $card.text();
    const price = parsePrice(priceText);

    // Category
    const categoryEl = $card.find(
      "[class*='category'], [class*='Category'], [class*='genre'], [class*='Genre']",
    ).first();
    const category = categoryEl.text().trim() || undefined;

    // Description — longest text block
    let description = "";
    $card.find("p, span, div").each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > description.length && text.length > 30 && text !== title) {
        description = text;
      }
    });

    // Applicant count — look for numbers near 応募/提案
    let applicantCount: number | null = null;
    const fullText = $card.text();
    const applicantMatch = fullText.match(/(\d+)\s*(?:件|人|名)(?:の応募|の提案|が応募)/);
    if (applicantMatch) {
      applicantCount = Number(applicantMatch[1]);
    }

    // Posted date
    let postedAt: string | null = null;
    const dateEl = $card.find("time").first();
    if (dateEl.length > 0) {
      postedAt = dateEl.attr("datetime") ?? dateEl.text().trim() ?? null;
    }

    jobs.push({
      source: "coconala",
      title,
      url,
      price,
      currency: "JPY",
      deadline: null,
      applicantCount,
      beginnerFriendly: null,
      description: description || undefined,
      category,
      jobType: "依頼",
      skills: undefined,
      clientRating: null,
      clientJobCount: null,
      postedAt,
    });
  });

  return jobs;
}

export async function fetchCoconalaJobs(
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
          const text = `${job.title} ${job.description ?? ""}`.toLowerCase();
          job.matchedKeywords = config.keywords.filter((k) =>
            text.includes(k.toLowerCase()),
          );
          allJobs.push(job);
        }
      }
      console.log(`  [coconala] "${keyword}" -> ${jobs.length} jobs`);
    } catch (err) {
      console.error(`  [coconala] "${keyword}" error:`, err);
    }
  }

  console.log(`  [coconala] total unique: ${allJobs.length}`);
  return allJobs;
}
