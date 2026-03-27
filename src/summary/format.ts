import type { ScoredJob } from "../types.js";

function formatPrice(price: number | null, currency?: string): string {
  if (price == null) return "N/A";
  return `${price.toLocaleString("ja-JP")}${currency === "JPY" ? "円" : ` ${currency ?? ""}`}`;
}

function showValue(v: string | number | boolean | null | undefined): string {
  if (v == null) return "N/A";
  if (typeof v === "boolean") return v ? "はい" : "いいえ";
  return String(v);
}

export function formatDiscordSummary(scoredJobs: ScoredJob[], topN: number): string {
  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const picked = scoredJobs.slice(0, topN);
  const lines: string[] = [
    `**案件ダイジェスト ${today}**`,
    `取得: ${scoredJobs.length}件 / 上位: ${picked.length}件`,
    "",
  ];

  if (picked.length === 0) {
    lines.push("条件に合う案件がありませんでした。");
    return lines.join("\n");
  }

  picked.forEach((job, i) => {
    lines.push(
      `**${i + 1}. [${job.title}](${job.url})**`,
      `  ${job.source} | ${formatPrice(job.price, job.currency)} | 応募: ${showValue(job.applicantCount)} | スコア: ${job.score}`,
    );
    if (job.category) lines.push(`  カテゴリ: ${job.category}`);
    if (job.jobType) lines.push(`  形式: ${job.jobType}`);
    if (job.deadline) lines.push(`  締切: ${job.deadline}`);
    if (job.beginnerFriendly === true) lines.push(`  初心者歓迎`);
    lines.push(
      `  -> ${job.reasons.join(" | ") || "N/A"}`,
      "",
    );
  });

  return lines.join("\n");
}
