import type { RepeatEndType, RepeatFrequency, RepeatWeekday, Task } from "./types";

export const repeatFrequencies: RepeatFrequency[] = ["none", "daily", "weekly", "monthly", "yearly", "custom"];
export const repeatEndTypes: RepeatEndType[] = ["never", "onDate", "afterCount"];
export const repeatWeekdays: RepeatWeekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const weekdayIndexes: Record<RepeatWeekday, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const weekdayLabels: Record<RepeatWeekday, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export function normalizeDueDateTime(dueDate: string | null | undefined, dueTime: string | null | undefined) {
  if (!dueDate) {
    return null;
  }

  const time = dueTime && /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : "23:59";
  const value = new Date(`${dueDate}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function isTaskOverdue(task: Pick<Task, "dueDate" | "dueTime" | "status">, now = new Date()) {
  if (!task.dueDate || task.status === "done" || task.status === "archived") {
    return false;
  }

  const due = normalizeDueDateTime(task.dueDate, task.dueTime);
  return Boolean(due && due.getTime() < now.getTime());
}

export function sortTasksByDueDateTime(tasks: Task[]) {
  return [...tasks].sort((left, right) => {
    const leftDue = normalizeDueDateTime(left.dueDate, left.dueTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightDue = normalizeDueDateTime(right.dueDate, right.dueTime)?.getTime() ?? Number.MAX_SAFE_INTEGER;

    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    return priorityRank(right.priority) - priorityRank(left.priority);
  });
}

export function calculateNextDueDate(task: Task, fromDate = task.dueDate || toDateId(new Date())) {
  if (!task.repeatEnabled || task.repeatFrequency === "none") {
    return null;
  }

  const interval = Math.max(1, Number(task.repeatInterval || 1));
  const start = parseDateId(fromDate) ?? new Date();

  if (task.repeatFrequency === "daily" || task.repeatFrequency === "custom") {
    return toDateId(addDays(start, interval));
  }

  if (task.repeatFrequency === "weekly") {
    return nextWeeklyDate(start, task.repeatDaysOfWeek, interval);
  }

  if (task.repeatFrequency === "monthly") {
    const next = new Date(start);
    next.setMonth(next.getMonth() + interval);
    const targetDay = task.repeatDayOfMonth ?? start.getDate();
    next.setDate(Math.min(targetDay, daysInMonth(next)));
    return toDateId(next);
  }

  if (task.repeatFrequency === "yearly") {
    const next = new Date(start);
    next.setFullYear(next.getFullYear() + interval);
    return toDateId(next);
  }

  return null;
}

export function shouldStopRecurrence(task: Task, completedOccurrences: number, nextDueDate: string | null) {
  if (!task.repeatEnabled || task.repeatFrequency === "none") {
    return true;
  }

  if (task.repeatEndType === "afterCount" && task.repeatCount && completedOccurrences >= task.repeatCount) {
    return true;
  }

  if (task.repeatEndType === "onDate" && task.repeatEndDate && nextDueDate && nextDueDate > task.repeatEndDate) {
    return true;
  }

  return false;
}

export function getStatusForNextDueDate(nextDueDate: string | null): Task["status"] {
  if (!nextDueDate) {
    return "inbox";
  }

  const today = toDateId(new Date());
  return nextDueDate <= today ? "today" : "upcoming";
}

export function formatRecurrenceSummary(task: Task) {
  if (!task.repeatEnabled || task.repeatFrequency === "none") {
    return "";
  }

  const every = task.repeatInterval > 1 ? `every ${task.repeatInterval} ${task.repeatFrequency === "custom" ? "days" : `${task.repeatFrequency}s`}` : task.repeatFrequency;
  const dayText =
    task.repeatFrequency === "weekly" && task.repeatDaysOfWeek.length > 0
      ? ` on ${task.repeatDaysOfWeek.map((day) => weekdayLabels[day]).join("/")}`
      : "";
  const countText =
    task.repeatEndType === "afterCount" && task.repeatCount
      ? ` · ${Math.min(task.completedOccurrences, task.repeatCount)} of ${task.repeatCount} completed`
      : "";
  const endText = task.repeatEndType === "onDate" && task.repeatEndDate ? ` · ends ${task.repeatEndDate}` : task.repeatEndType === "never" ? " · forever" : "";
  const nextText = task.nextDueDate ? ` · next ${task.nextDueDate}` : "";

  return `Repeats ${every}${dayText}${countText}${endText}${nextText}`;
}

function nextWeeklyDate(start: Date, daysOfWeek: RepeatWeekday[], interval: number) {
  const selectedIndexes = (daysOfWeek.length > 0 ? daysOfWeek : [indexToWeekday(start.getDay())])
    .map((day) => weekdayIndexes[day])
    .sort((left, right) => left - right);

  for (let offset = 1; offset <= interval * 7 + 7; offset += 1) {
    const candidate = addDays(start, offset);
    const weekDistance = Math.floor(offset / 7);
    if (selectedIndexes.includes(candidate.getDay()) && (offset < 7 || weekDistance % interval === 0)) {
      return toDateId(candidate);
    }
  }

  return toDateId(addDays(start, interval * 7));
}

function indexToWeekday(index: number): RepeatWeekday {
  return repeatWeekdays.find((day) => weekdayIndexes[day] === index) ?? "monday";
}

function daysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDateId(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateId(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function priorityRank(priority: Task["priority"]) {
  return priority === "urgent" ? 4 : priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}
