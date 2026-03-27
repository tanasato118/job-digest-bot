const DISCORD_MAX_LENGTH = 1990;

function splitMessage(content: string): string[] {
  if (content.length <= DISCORD_MAX_LENGTH) return [content];

  const chunks: string[] = [];
  const lines = content.split("\n");
  let current = "";

  for (const line of lines) {
    if (current.length + line.length + 1 > DISCORD_MAX_LENGTH) {
      if (current) chunks.push(current);
      current = line;
    } else {
      current += (current ? "\n" : "") + line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function postToDiscord(
  webhookUrl: string,
  content: string,
): Promise<void> {
  const chunks = splitMessage(content);
  for (const chunk of chunks) {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: chunk }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Discord webhook failed: ${res.status} ${body}`);
    }
    // Rate limit: wait briefly between messages
    if (chunks.length > 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}
