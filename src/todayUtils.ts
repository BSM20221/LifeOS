import type { DailyPlan, DailyReflection, EnergyLevel, MoodLevel, Task, TimeBlock, TimeBlockFormValues, TimeBlockType, TodayStats } from "./types";
import { getDueDateGroup } from "./filterUtils";

export const emptyReflection: DailyReflection = {
  wentWell: "",
  distractions: "",
  improveTomorrow: "",
  energyLevel: null,
  mood: null,
};

export function getTodayDateId(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function createEmptyDailyPlan(userId: string, dateId: string): DailyPlan {
  return {
    id: dateId,
    userId,
    date: dateId,
    topTaskIds: [],
    deepWorkTaskId: null,
    timeBlocks: [],
    reflection: emptyReflection,
    createdAt: null,
    updatedAt: null,
  };
}

export function calculateTodayStats(tasks: Task[], plan: DailyPlan, dateId = getTodayDateId()): TodayStats {
  const todayTaskList = tasks.filter((task) => task.status === "today");
  const overdueTaskList = tasks.filter((task) => task.status !== "done" && task.status !== "archived" && getDueDateGroup(task.dueDate) === "overdue");
  const completedToday = tasks.filter((task) => task.status === "done" && task.dueDate === dateId).length;
  const topCompleted = plan.topTaskIds.filter((taskId) => tasks.find((task) => task.id === taskId)?.status === "done").length;

  return {
    todayTasks: todayTaskList.length,
    overdueTasks: overdueTaskList.length,
    totalEstimatedMinutes: todayTaskList.reduce((total, task) => total + Number(task.estimatedMinutes || 0), 0),
    completedToday,
    topCompleted,
  };
}

export function sortTimeBlocks(blocks: TimeBlock[]) {
  return [...blocks].sort((left, right) => left.startTime.localeCompare(right.startTime) || left.endTime.localeCompare(right.endTime));
}

export function validateTimeBlock(values: TimeBlockFormValues) {
  const errors: string[] = [];
  if (!values.taskId && !values.title.trim()) {
    errors.push("Add a title or assign a task.");
  }

  if (!values.startTime) {
    errors.push("Start time is required.");
  }

  if (!values.endTime) {
    errors.push("End time is required.");
  }

  if (values.startTime && values.endTime && values.endTime <= values.startTime) {
    errors.push("End time must be after start time.");
  }

  return errors;
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function labelTimeBlockType(type: TimeBlockType) {
  switch (type) {
    case "deep-work":
      return "Deep work";
    case "study":
      return "Study";
    case "admin":
      return "Admin";
    case "health":
      return "Health";
    case "break":
      return "Break";
    case "personal":
      return "Personal";
    case "other":
      return "Other";
  }
}

export function normalizeReflection(value: Partial<DailyReflection> | undefined): DailyReflection {
  return {
    wentWell: String(value?.wentWell ?? ""),
    distractions: String(value?.distractions ?? ""),
    improveTomorrow: String(value?.improveTomorrow ?? ""),
    energyLevel: isReflectionEnergy(value?.energyLevel) ? value.energyLevel : null,
    mood: isMoodLevel(value?.mood) ? value.mood : null,
  };
}

export function normalizeTimeBlock(value: unknown): TimeBlock | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const block = value as Partial<TimeBlock>;
  if (!block.id || !block.startTime || !block.endTime) {
    return null;
  }

  return {
    id: String(block.id),
    taskId: typeof block.taskId === "string" ? block.taskId : null,
    title: String(block.title ?? ""),
    startTime: String(block.startTime),
    endTime: String(block.endTime),
    type: isTimeBlockType(block.type) ? block.type : "other",
    notes: String(block.notes ?? ""),
    completed: Boolean(block.completed),
  };
}

export function isTimeBlockType(value: unknown): value is TimeBlockType {
  return (
    value === "deep-work" ||
    value === "study" ||
    value === "admin" ||
    value === "health" ||
    value === "break" ||
    value === "personal" ||
    value === "other"
  );
}

function isReflectionEnergy(value: unknown): value is EnergyLevel {
  return value === "low" || value === "medium" || value === "high";
}

function isMoodLevel(value: unknown): value is MoodLevel {
  return value === "low" || value === "okay" || value === "good" || value === "great";
}
