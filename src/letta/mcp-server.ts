#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  getCoreMemory,
  getBlock,
  updateBlock,
  searchArchival,
  insertArchival,
  readAll,
} from "./client.js";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const HANDOFF_PATH = join(process.cwd(), ".ai-handoff.md");

// ── Handoff file helpers ──

async function readHandoff(): Promise<string> {
  try {
    return await readFile(HANDOFF_PATH, "utf8");
  } catch {
    return "(no handoff file yet)";
  }
}

async function appendHandoff(who: string, content: string): Promise<void> {
  const now = new Date().toISOString().slice(0, 19).replace("T", " ");
  const entry = `\n### [${who}] ${now}\n${content}\n`;
  let existing = "";
  try {
    existing = await readFile(HANDOFF_PATH, "utf8");
  } catch { /* new file */ }
  if (!existing.startsWith("# AI Handoff Log")) {
    existing = "# AI Handoff Log\n\nCursor <-> Claude Code の共有作業ログ\n";
  }
  await writeFile(HANDOFF_PATH, existing + entry, "utf8");
}

// ── MCP Server ──

const server = new McpServer({
  name: "claude-subconscious",
  version: "1.0.0",
});

// --- Tools ---

server.tool(
  "memory_dashboard",
  "Show current memory status and all available commands",
  {},
  async () => {
    const core = await getCoreMemory();
    const skip = new Set(["memory_tools_guide", "memory_instructions"]);
    const blocks = core.blocks.filter((b) => !skip.has(b.label));

    const lines = ["# Claude Subconscious - Memory Dashboard\n"];
    for (const b of blocks) {
      const status = b.value === "[empty]" ? "empty" : "has data";
      const preview =
        b.value === "[empty]"
          ? ""
          : `  ${b.value.replace(/\n/g, " ").slice(0, 80)}...`;
      lines.push(`- **${b.label}** (${status})${preview}`);
    }

    let archCount = 0;
    try {
      const a = await searchArchival("*", 50);
      archCount = a.length;
    } catch { /* empty */ }
    lines.push(`- **archival** (${archCount} entries)`);

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  },
);

server.tool(
  "memory_read",
  "Read all memory (core blocks + archival). Use at the start of every session.",
  {},
  async () => {
    const all = await readAll();
    return { content: [{ type: "text" as const, text: all }] };
  },
);

server.tool(
  "memory_get",
  "Read a specific memory block",
  { label: z.enum(["about_user", "custom_instructions", "learned_corrections", "preferences", "scratchpad"]).describe("Which memory block to read") },
  async ({ label }) => {
    const val = await getBlock(label);
    return { content: [{ type: "text" as const, text: `[${label}]\n${val}` }] };
  },
);

server.tool(
  "memory_write",
  "Write to a specific memory block. Use when you learn something about the user or their preferences.",
  {
    label: z.enum(["about_user", "custom_instructions", "learned_corrections", "preferences", "scratchpad"]).describe("Which block to write to"),
    value: z.string().describe("Content to write"),
  },
  async ({ label, value }) => {
    await updateBlock(label, value);
    return { content: [{ type: "text" as const, text: `Updated "${label}"` }] };
  },
);

server.tool(
  "memory_search",
  "Search long-term archival memory by keyword",
  { query: z.string().describe("Search query") },
  async ({ query }) => {
    const results = await searchArchival(query);
    if (results.length === 0)
      return { content: [{ type: "text" as const, text: "No results." }] };
    const text = results.map((r) => `- ${r.content}`).join("\n");
    return { content: [{ type: "text" as const, text: `Search: "${query}" (${results.length} hits)\n\n${text}` }] };
  },
);

server.tool(
  "memory_archive",
  "Save to long-term archival memory (searchable). Use for project history, decisions, important events.",
  { content: z.string().describe("Content to archive") },
  async ({ content }) => {
    const entry = await insertArchival(content);
    return { content: [{ type: "text" as const, text: `Archived: ${entry.id}` }] };
  },
);

server.tool(
  "handoff_read",
  "Read the shared AI handoff log. See what the other AI (Cursor or Claude Code) has been working on.",
  {},
  async () => {
    const text = await readHandoff();
    return { content: [{ type: "text" as const, text }] };
  },
);

server.tool(
  "handoff_write",
  "Write to the shared AI handoff log. Log what you did, decisions made, or context the other AI needs.",
  {
    who: z.enum(["cursor", "claude-code"]).describe("Which AI is writing"),
    content: z.string().describe("What to log (work done, decisions, context for the other AI)"),
  },
  async ({ who, content }) => {
    await appendHandoff(who, content);
    return { content: [{ type: "text" as const, text: `Logged to handoff (${who})` }] };
  },
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
