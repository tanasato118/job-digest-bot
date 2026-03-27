import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getConfig } from "./config.js";
import { scoreJobs } from "./match/scoring.js";
import { postToDiscord } from "./notify/discord.js";
import { fetchCrowdworksJobs } from "./sources/crowdworks.js";
import { dedupeJobs } from "./sources/common.js";
import { fetchLancersJobs } from "./sources/lancers.js";
import { formatDiscordSummary } from "./summary/format.js";

async function collectJobs() {
  const config = getConfig();
  const fetchers: Promise<import("./types.js").NormalizedJob[]>[] = [];

  if (config.enableCrowdworks) {
    fetchers.push(fetchCrowdworksJobs(config));
  }
  if (config.enableLancers) {
    fetchers.push(fetchLancersJobs(config));
  }

  const results = await Promise.all(fetchers);
  return { config, jobs: dedupeJobs(results.flat()) };
}

async function runFetch() {
  const { jobs } = await collectJobs();
  await mkdir("jobs-output", { recursive: true });
  const path = join("jobs-output", "latest-jobs.json");
  await writeFile(path, JSON.stringify(jobs, null, 2), "utf8");
  console.log(`\nfetch done: ${jobs.length} jobs -> ${path}`);
}

async function runDigest() {
  const { config, jobs } = await collectJobs();
  const scored = scoreJobs(jobs, config);
  const summary = formatDiscordSummary(scored, config.topN);
  await mkdir("jobs-output", { recursive: true });
  const path = join("jobs-output", "latest-summary.txt");
  await writeFile(path, summary, "utf8");
  console.log(summary);
  console.log(`\ndigest done -> ${path}`);
}

async function runNotify() {
  const { config, jobs } = await collectJobs();
  const scored = scoreJobs(jobs, config);
  const summary = formatDiscordSummary(scored, config.topN);
  if (!config.discordWebhookUrl) {
    throw new Error("DISCORD_WEBHOOK_URL is missing");
  }
  await postToDiscord(config.discordWebhookUrl, summary);
  console.log("notify done: summary sent to Discord");
}

async function main() {
  const mode = process.argv[2];
  if (mode === "fetch") return runFetch();
  if (mode === "digest") return runDigest();
  if (mode === "notify") return runNotify();
  console.log("Usage: npm run fetch | npm run digest | npm run notify");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
