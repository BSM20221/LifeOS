import type { Project, TaskPriority } from "./types";
import { normalizeTags } from "./filterUtils";

const priorityTokens: Record<string, TaskPriority> = {
  "!low": "low",
  "!medium": "medium",
  "!high": "high",
  "!urgent": "urgent",
};

export function parseQuickCapture(input: string, projects: Project[] = []) {
  const raw = input.trim();
  const projectMatch = findProjectToken(raw, projects);
  const projectTokenPattern = projectMatch?.pattern ?? unresolvedProjectPattern(raw);
  const textWithoutProject = projectTokenPattern ? raw.replace(projectTokenPattern, " ") : raw;
  const unresolvedProjectName = projectMatch ? "" : readUnresolvedProjectName(raw);

  const tags = normalizeTags(Array.from(textWithoutProject.matchAll(/#([\w-]+)/g)).map((match) => match[1]));
  const priorityMatch = textWithoutProject.match(/!(low|medium|high|urgent)\b/i);
  const priority = priorityMatch ? priorityTokens[priorityMatch[0].toLowerCase()] : "medium";

  const title = textWithoutProject
    .replace(/#([\w-]+)/g, "")
    .replace(/!(low|medium|high|urgent)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title,
    tags: Array.from(new Set(tags)),
    priority,
    projectId: projectMatch?.project.id ?? null,
    projectName: projectMatch?.project.name ?? "",
    unresolvedProjectName,
  };
}

export const parseQuickTask = parseQuickCapture;

function findProjectToken(raw: string, projects: Project[]) {
  const sortedProjects = [...projects].sort((left, right) => right.name.length - left.name.length);

  for (const project of sortedProjects) {
    const pattern = new RegExp(`(^|\\s)\\+${escapeRegExp(project.name)}(?=\\s|$)`, "i");
    if (pattern.test(raw)) {
      return { project, pattern };
    }
  }

  return null;
}

function unresolvedProjectPattern(raw: string) {
  return raw.match(/(^|\s)\+([A-Za-z0-9][A-Za-z0-9&/.' -]*?)(?=\s[# !]|$)/)?.[0] ? /(^|\s)\+([A-Za-z0-9][A-Za-z0-9&/.' -]*?)(?=\s[# !]|$)/ : null;
}

function readUnresolvedProjectName(raw: string) {
  const match = raw.match(/(^|\s)\+([A-Za-z0-9][A-Za-z0-9&/.' -]*?)(?=\s[# !]|$)/);
  return match?.[2]?.trim() ?? "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
