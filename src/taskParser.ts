import type { Project, Reminder, RepeatFrequency, RepeatWeekday, TaskPriority } from "./types";
import { normalizeTags } from "./filterUtils";
import { calculateReminderTime, createLocalReminderId } from "./reminderUtils";

const priorityTokens: Record<string, TaskPriority> = {
  "!low": "low",
  "!medium": "medium",
  "!high": "high",
  "!urgent": "urgent",
};

export function parseQuickCapture(input: string, projects: Project[] = []) {
  const raw = input.trim();
  const dueDate = parseDueDate(raw);
  const dueTime = parseDueTime(raw);
  const recurrence = parseRecurrence(raw);
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
    .replace(/\b(today|tomorrow)\b/gi, "")
    .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, "")
    .replace(/\bevery\s+(day|daily|week|weekly|month|monthly|year|yearly)\b/gi, "")
    .replace(/\bevery\s+((mon|tue|wed|thu|fri|sat|sun)(day)?)(\/((mon|tue|wed|thu|fri|sat|sun)(day)?))*\b/gi, "")
    .replace(/\bfor\s+\d+\s*(times|days|weeks|months)?\b/gi, "")
    .replace(/\bremind\s+\d+\s*(minute|minutes|hour|hours|day|days)\s+before\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const reminders = createParsedReminders(raw, dueDate, dueTime);

  return {
    title,
    tags: Array.from(new Set(tags)),
    priority,
    dueDate,
    dueTime,
    projectId: projectMatch?.project.id ?? null,
    projectName: projectMatch?.project.name ?? "",
    unresolvedProjectName,
    reminders,
    ...recurrence,
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

function parseDueDate(raw: string) {
  const today = new Date();
  if (/\btoday\b/i.test(raw)) {
    return toDateId(today);
  }

  if (/\btomorrow\b/i.test(raw)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return toDateId(tomorrow);
  }

  return "";
}

function parseDueTime(raw: string) {
  const match = raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) {
    return "";
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function parseRecurrence(raw: string): {
  repeatEnabled: boolean;
  repeatFrequency: RepeatFrequency;
  repeatInterval: number;
  repeatDaysOfWeek: RepeatWeekday[];
  repeatDayOfMonth: number | null;
  repeatEndType: "never" | "afterCount";
  repeatEndDate: null;
  repeatCount: number | null;
} {
  const weeklyDays = parseWeeklyDays(raw);
  const repeatCountMatch = raw.match(/\bfor\s+(\d+)\s*(times|days|weeks|months)?\b/i);
  const repeatCount = repeatCountMatch ? Math.max(1, Number(repeatCountMatch[1])) : null;
  const lower = raw.toLowerCase();
  let repeatFrequency: RepeatFrequency = "none";

  if (weeklyDays.length > 0 || /\bevery\s+(week|weekly)\b/.test(lower)) repeatFrequency = "weekly";
  if (/\bevery\s+(day|daily)\b/.test(lower)) repeatFrequency = "daily";
  if (/\bmonthly\b|\bevery\s+month\b/.test(lower)) repeatFrequency = "monthly";
  if (/\byearly\b|\bevery\s+year\b/.test(lower)) repeatFrequency = "yearly";

  return {
    repeatEnabled: repeatFrequency !== "none",
    repeatFrequency,
    repeatInterval: 1,
    repeatDaysOfWeek: weeklyDays,
    repeatDayOfMonth: null,
    repeatEndType: repeatCount ? "afterCount" : "never",
    repeatEndDate: null,
    repeatCount,
  };
}

function parseWeeklyDays(raw: string): RepeatWeekday[] {
  const match = raw.match(/\bevery\s+((?:(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?)(?:\/(?:(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?))*)\b/i);
  if (!match) {
    return [];
  }

  const map: Record<string, RepeatWeekday> = {
    mon: "monday",
    monday: "monday",
    tue: "tuesday",
    tuesday: "tuesday",
    wed: "wednesday",
    wednesday: "wednesday",
    thu: "thursday",
    thursday: "thursday",
    fri: "friday",
    friday: "friday",
    sat: "saturday",
    saturday: "saturday",
    sun: "sunday",
    sunday: "sunday",
  };

  return match[1]
    .split("/")
    .map((day) => map[day.toLowerCase()])
    .filter((day): day is RepeatWeekday => Boolean(day));
}

function createParsedReminders(raw: string, dueDate: string, dueTime: string) {
  const match = raw.match(/\bremind\s+(\d+)\s*(minute|minutes|hour|hours|day|days)\s+before\b/i);
  if (!match || !dueDate) {
    return [] as Reminder[];
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const minutesBefore = unit.startsWith("hour") ? amount * 60 : unit.startsWith("day") ? amount * 1440 : amount;
  const remindAt = calculateReminderTime(dueDate, dueTime || "09:00", minutesBefore);
  if (!remindAt) {
    return [] as Reminder[];
  }

  const now = new Date().toISOString();
  return [
    {
      id: createLocalReminderId(),
      taskId: "",
      type: "before-due",
      remindAt,
      minutesBefore,
      enabled: true,
      firedAt: null,
      dismissedAt: null,
      snoozedUntil: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function toDateId(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
