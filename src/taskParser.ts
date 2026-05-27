import type { TaskPriority } from "./types";

const priorityTokens: Record<string, TaskPriority> = {
  "!low": "low",
  "!medium": "medium",
  "!high": "high",
  "!urgent": "urgent",
};

export function parseQuickTask(input: string) {
  const raw = input.trim();
  const tags = Array.from(raw.matchAll(/#([\w-]+)/g)).map((match) => match[1].toLowerCase());
  const priorityMatch = raw.match(/!(low|medium|high|urgent)\b/i);
  const priority = priorityMatch ? priorityTokens[priorityMatch[0].toLowerCase()] : "medium";

  const title = raw
    .replace(/#([\w-]+)/g, "")
    .replace(/!(low|medium|high|urgent)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title,
    tags: Array.from(new Set(tags)),
    priority,
  };
}
