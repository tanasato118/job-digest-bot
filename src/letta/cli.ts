import "dotenv/config";
import {
  getBlock,
  updateBlock,
  readAll,
  searchArchival,
  insertArchival,
  getCoreMemory,
} from "./client.js";

// ── Colors ──

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgCyan: "\x1b[46m\x1b[30m",
  bgGreen: "\x1b[42m\x1b[30m",
  bgYellow: "\x1b[43m\x1b[30m",
};

function tag(bg: string, text: string) {
  return `${bg} ${text} ${c.reset}`;
}

function truncate(s: string, max: number): string {
  const line = s.replace(/\n/g, " ").trim();
  return line.length > max ? line.slice(0, max - 1) + "…" : line;
}

// ── Dashboard ──

const SKIP_LABELS = new Set(["memory_tools_guide", "memory_instructions"]);

async function dashboard() {
  console.log("");
  console.log(
    `${c.bold}${c.cyan}  Claude Subconscious${c.reset}  ${c.dim}powered by Letta${c.reset}`,
  );
  console.log(`${c.dim}${"─".repeat(52)}${c.reset}`);

  // Memory status
  let core;
  try {
    core = await getCoreMemory();
  } catch {
    console.log(`\n  ${c.yellow}! API に接続できません。.env の LETTA_API_KEY を確認してください${c.reset}\n`);
    showCommands();
    return;
  }

  const blocks = core.blocks.filter((b) => !SKIP_LABELS.has(b.label));

  console.log(`\n${c.bold}  MEMORY STATUS${c.reset}\n`);

  for (const block of blocks) {
    const empty = block.value === "[empty]";
    const icon = empty ? `${c.dim}○${c.reset}` : `${c.green}●${c.reset}`;
    const label = `${c.bold}${block.label}${c.reset}`;
    const preview = empty
      ? `${c.dim}(empty)${c.reset}`
      : `${c.dim}${truncate(block.value, 50)}${c.reset}`;
    console.log(`  ${icon} ${label}`);
    console.log(`    ${preview}`);
  }

  let archivalCount = 0;
  try {
    const arch = await searchArchival("*", 50);
    archivalCount = arch.length;
  } catch { /* empty */ }

  const archIcon = archivalCount > 0 ? `${c.green}●${c.reset}` : `${c.dim}○${c.reset}`;
  console.log(
    `  ${archIcon} ${c.bold}archival${c.reset}`,
  );
  console.log(
    `    ${c.dim}${archivalCount > 0 ? `${archivalCount} entries` : "(empty)"}${c.reset}`,
  );

  console.log("");
  showCommands();
}

function showCommands() {
  console.log(`${c.dim}${"─".repeat(52)}${c.reset}`);
  console.log(`${c.bold}  COMMANDS${c.reset}\n`);

  const cmds: [string, string, string][] = [
    [
      "npm run memory",
      "このダッシュボードを表示",
      "",
    ],
    [
      "npm run memory:read",
      "全メモリの内容を表示",
      "",
    ],
    [
      "npm run memory:get -- about_user",
      "指定ブロックを読む",
      "about_user / custom_instructions / learned_corrections",
    ],
    [
      "npm run memory:set -- about_user \"内容\"",
      "ブロックに書き込む",
      "",
    ],
    [
      "npm run memory:search -- \"キーワード\"",
      "長期記憶を検索",
      "",
    ],
    [
      "npm run memory:insert -- \"記録したい内容\"",
      "長期記憶に追加",
      "",
    ],
  ];

  for (const [cmd, desc, hint] of cmds) {
    console.log(`  ${c.cyan}${cmd}${c.reset}`);
    console.log(`  ${c.dim}${desc}${c.reset}`);
    if (hint) console.log(`  ${c.dim}  (${hint})${c.reset}`);
    console.log("");
  }

  console.log(`${c.dim}${"─".repeat(52)}${c.reset}`);
  console.log(`${c.bold}  MEMORY BLOCKS${c.reset}\n`);
  console.log(`  ${tag(c.bgCyan, "about_user")}           あなたの情報（名前・職業・スキル）`);
  console.log(`  ${tag(c.bgGreen, "custom_instructions")}  作業スタイルの好み・指示`);
  console.log(`  ${tag(c.bgYellow, "learned_corrections")} 過去の修正・フィードバック`);
  console.log(`  ${c.dim}archival${c.reset}                 長期記憶（検索可能）`);
  console.log("");
}

// ── Command handlers ──

async function cmdReadAll() {
  const all = await readAll();
  console.log(all);
}

async function cmdGet(label: string) {
  const val = await getBlock(label);
  console.log(`\n${c.bold}  [${label}]${c.reset}\n`);
  console.log(`  ${val.replace(/\n/g, "\n  ")}`);
  console.log("");
}

async function cmdSet(label: string, value: string) {
  await updateBlock(label, value);
  console.log(`\n  ${c.green}OK${c.reset} ${c.bold}${label}${c.reset} を更新しました\n`);
}

async function cmdSearch(query: string) {
  const results = await searchArchival(query);
  console.log(`\n${c.bold}  SEARCH: "${query}"${c.reset}  ${c.dim}(${results.length} hits)${c.reset}\n`);
  if (results.length === 0) {
    console.log(`  ${c.dim}該当なし${c.reset}\n`);
    return;
  }
  for (const r of results) {
    console.log(`  ${c.dim}[${r.id.slice(0, 12)}]${c.reset} ${r.content}`);
  }
  console.log("");
}

async function cmdInsert(content: string) {
  const entry = await insertArchival(content);
  console.log(`\n  ${c.green}OK${c.reset} archival に保存しました ${c.dim}(${entry.id})${c.reset}\n`);
}

// ── Main ──

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  switch (cmd) {
    case "read-all":
      return cmdReadAll();
    case "get": {
      if (!args[0]) { console.error("Usage: get <label>"); process.exit(1); }
      return cmdGet(args[0]);
    }
    case "set": {
      const label = args[0];
      const value = args.slice(1).join(" ");
      if (!label || !value) { console.error("Usage: set <label> <value>"); process.exit(1); }
      return cmdSet(label, value);
    }
    case "search": {
      const query = args.join(" ");
      if (!query) { console.error("Usage: search <query>"); process.exit(1); }
      return cmdSearch(query);
    }
    case "insert": {
      const content = args.join(" ");
      if (!content) { console.error("Usage: insert <content>"); process.exit(1); }
      return cmdInsert(content);
    }
    default:
      return dashboard();
  }
}

main().catch((err) => {
  console.error(`\n  ${c.yellow}ERROR:${c.reset} ${err.message}\n`);
  process.exit(1);
});
