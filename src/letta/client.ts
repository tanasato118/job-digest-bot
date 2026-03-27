

interface LettaConfig {
  apiUrl: string;
  apiKey: string;
  agentId?: string;
}

interface MemoryBlock {
  label: string;
  value: string;
  id: string;
  limit: number;
}

interface CoreMemory {
  blocks: MemoryBlock[];
}

interface ArchivalEntry {
  id: string;
  content: string;
  created_at?: string;
}

function env(): LettaConfig {
  const apiUrl = process.env.LETTA_API_URL ?? "https://api.letta.com";
  const apiKey = process.env.LETTA_API_KEY;
  if (!apiKey) throw new Error("LETTA_API_KEY is not set");
  return { apiUrl, apiKey, agentId: process.env.LETTA_AGENT_ID };
}

async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const { apiUrl, apiKey } = env();
  const res = await fetch(`${apiUrl}/v1${path}`, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Letta API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Core Memory ──

export async function getCoreMemory(): Promise<CoreMemory> {
  const agentId = env().agentId;
  return api<CoreMemory>(`/agents/${agentId}/core-memory`);
}

export async function getBlock(label: string): Promise<string> {
  const mem = await getCoreMemory();
  const block = mem.blocks.find((b) => b.label === label);
  return block?.value ?? "[empty]";
}

export async function updateBlock(
  label: string,
  value: string,
): Promise<MemoryBlock> {
  const mem = await getCoreMemory();
  const block = mem.blocks.find((b) => b.label === label);
  if (!block) throw new Error(`Block "${label}" not found`);
  return api<MemoryBlock>(`/blocks/${block.id}`, {
    method: "PATCH",
    body: { value },
  });
}

// ── Archival Memory ──

export async function searchArchival(
  query: string,
  limit = 10,
): Promise<ArchivalEntry[]> {
  const { apiUrl, apiKey, agentId } = env();
  const params = new URLSearchParams({ query, limit: String(limit) });
  const res = await fetch(
    `${apiUrl}/v1/agents/${agentId}/archival-memory?${params}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Letta API ${res.status}: ${text}`);
  }
  const data = (await res.json()) as Array<{ id: string; text: string; created_at?: string }>;
  return data.map((d) => ({ id: d.id, content: d.text, created_at: d.created_at }));
}

export async function insertArchival(content: string): Promise<ArchivalEntry> {
  const agentId = env().agentId;
  const results = await api<ArchivalEntry[]>(
    `/agents/${agentId}/archival-memory`,
    { method: "POST", body: { text: content } },
  );
  return results[0] ?? ({ id: "", content } as ArchivalEntry);
}

// ── All Memory (read all blocks + recent archival) ──

export async function readAll(): Promise<string> {
  const [core, archival] = await Promise.all([
    getCoreMemory(),
    searchArchival("*", 20).catch(() => [] as ArchivalEntry[]),
  ]);

  const lines: string[] = ["# Letta Subconscious Memory\n"];

  for (const block of core.blocks) {
    if (
      block.value === "[empty]" ||
      block.label === "memory_tools_guide" ||
      block.label === "memory_instructions"
    )
      continue;
    lines.push(`## ${block.label}\n${block.value}\n`);
  }

  if (archival.length > 0) {
    lines.push("## archival\n");
    for (const entry of archival) {
      lines.push(`- ${entry.content}`);
    }
  }

  return lines.join("\n");
}
