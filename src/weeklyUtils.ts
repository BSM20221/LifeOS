import type {
  DailyPlan,
  FocusSession,
  Habit,
  Project,
  ProjectHealthStatus,
  Task,
  WeekId,
  WeeklyFocusSummary,
  WeeklyHabitSummary,
  WeeklyInsightMessage,
  WeeklyProjectAction,
  WeeklyReview,
  WeeklyReviewStats,
} from "./types";
import { getCompletedFocusMinutes, resolveFocusSessionProjectId } from "./focusUtils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type WeekRange = {
  weekId: WeekId;
  startDate: string;
  endDate: string;
  days: string[];
};

export type WeeklyProjectSummary = {
  project: Project;
  openTasks: number;
  completedTasks: number;
  focusMinutes: number;
  lastActivityDate: string;
  health: ProjectHealthStatus;
  reason: string;
};

export type DailyReflectionSynthesis = {
  daysWithReflections: number;
  energySummary: string;
  moodSummary: string;
  distractions: string[];
  improvements: string[];
};

export function getCurrentWeekId(date = new Date()): WeekId {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function getWeekRange(weekId: WeekId = getCurrentWeekId()): WeekRange {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekId);
  const year = match ? Number(match[1]) : new Date().getFullYear();
  const week = match ? Number(match[2]) : Number(getCurrentWeekId().slice(-2));
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const weekOneMonday = addDays(januaryFourth, -((januaryFourth.getUTCDay() || 7) - 1));
  const start = addDays(weekOneMonday, (week - 1) * 7);
  const days = Array.from({ length: 7 }, (_, index) => toDateId(addDays(start, index)));

  return {
    weekId,
    startDate: days[0],
    endDate: days[6],
    days,
  };
}

export function getPreviousWeekId(weekId: WeekId) {
  return getCurrentWeekId(addDays(parseDateId(getWeekRange(weekId).startDate), -1));
}

export function getNextWeekId(weekId: WeekId) {
  return getCurrentWeekId(addDays(parseDateId(getWeekRange(weekId).endDate), 1));
}

export function formatWeekRange(range: WeekRange) {
  const start = parseDateId(range.startDate);
  const end = parseDateId(range.endDate);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const startLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(start);
  const endLabel = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(end);
  return sameYear ? `${startLabel} - ${endLabel}` : `${formatDate(range.startDate)} - ${formatDate(range.endDate)}`;
}

export function createEmptyWeeklyReview(userId: string, weekId: WeekId): WeeklyReview {
  const range = getWeekRange(weekId);

  return {
    id: weekId,
    userId,
    weekId,
    weekStartDate: range.startDate,
    weekEndDate: range.endDate,
    completedTaskIds: [],
    reviewedProjectIds: [],
    topWins: "",
    biggestStruggles: "",
    lessonsLearned: "",
    whatToStopDoing: "",
    whatToContinueDoing: "",
    whatToStartDoing: "",
    improveNextWeek: "",
    whatToImproveNextWeek: "",
    nextWeekPriorityTaskIds: [],
    nextWeekProjectIds: [],
    nextWeekNotes: "",
    projectReviewActions: {},
    projectReviewStates: {},
    habitReflection: "",
    focusReflection: "",
    moodSummary: "",
    energySummary: "",
    rating: null,
    createdAt: null,
    updatedAt: null,
    completedAt: null,
  };
}

export function getTasksForWeek(tasks: Task[], range: WeekRange) {
  return tasks.filter((task) => {
    const dates = [task.dueDate, getDateIdFromTimestampLike(task.createdAt), getDateIdFromTimestampLike(task.updatedAt), getCompletedDateId(task)].filter(Boolean);
    return dates.some((dateId) => isWithinWeek(dateId, range));
  });
}

export function getCompletedTasksForWeek(tasks: Task[], range: WeekRange) {
  return tasks.filter((task) => task.status === "done" && isWithinWeek(getCompletedDateId(task), range));
}

export function getFocusSessionsForWeek(sessions: FocusSession[], range: WeekRange) {
  return sessions.filter((session) => isWithinWeek(session.dailyPlanDate, range));
}

export function getDailyPlansForWeek(plans: DailyPlan[], range: WeekRange) {
  return plans.filter((plan) => isWithinWeek(plan.date, range));
}

export function getHabitStatsForWeek(habits: Habit[], range: WeekRange): WeeklyHabitSummary[] {
  return habits.map((habit) => {
    const completions = range.days.filter((dateId) => habit.completionDates.includes(dateId)).length;
    const target = Math.max(1, Math.min(7, habit.targetPerWeek || 7));
    return {
      habitId: habit.id,
      name: habit.name,
      emoji: habit.emoji,
      completions,
      targetPerWeek: target,
      completionRate: Math.min(100, Math.round((completions / target) * 100)),
      missedDays: Math.max(0, target - completions),
      streak: habit.streak,
    };
  });
}

export function calculateWeeklyStats({
  tasks,
  projects,
  sessions,
  habits,
  range,
}: {
  tasks: Task[];
  projects: Project[];
  sessions: FocusSession[];
  habits: Habit[];
  range: WeekRange;
}): WeeklyReviewStats {
  const completedTasks = getCompletedTasksForWeek(tasks, range);
  const weekSessions = getFocusSessionsForWeek(sessions, range);
  const completedSessions = weekSessions.filter((session) => session.status === "completed" && getCompletedFocusMinutes(session) > 0);
  const habitSummaries = getHabitStatsForWeek(habits, range);
  const habitsCompleted = habitSummaries.reduce((sum, habit) => sum + habit.completions, 0);
  const possibleHabitCompletions = habits.reduce((sum, habit) => sum + Math.max(1, Math.min(7, habit.targetPerWeek || 7)), 0);
  const projectsTouched = getTouchedProjectIds(tasks, sessions, range).size;
  const topProjectByFocus = getTopProjectByFocus(sessions, projects, tasks, range);
  const topTagByCompleted = getTopTagByCompleted(completedTasks);

  return {
    completedTasks: completedTasks.length,
    focusMinutes: completedSessions.reduce((sum, session) => sum + getCompletedFocusMinutes(session), 0),
    completedFocusSessions: completedSessions.length,
    habitsCompleted,
    habitCompletionRate: possibleHabitCompletions > 0 ? Math.round((habitsCompleted / possibleHabitCompletions) * 100) : null,
    overdueTasks: tasks.filter((task) => task.dueDate && task.dueDate <= range.endDate && task.dueDate < todayDateId() && task.status !== "done" && task.status !== "archived").length,
    projectsTouched,
    topProjectByFocus,
    topTagByCompleted,
  };
}

export function calculateWeeklyFocusSummary(sessions: FocusSession[], projects: Project[], tasks: Task[], range: WeekRange): WeeklyFocusSummary {
  const weekSessions = getFocusSessionsForWeek(sessions, range).filter((session) => session.status === "completed");
  const focusMinutes = weekSessions.reduce((sum, session) => sum + getCompletedFocusMinutes(session), 0);
  const completedSessions = weekSessions.filter((session) => getCompletedFocusMinutes(session) > 0);
  const focusByProject = [...getFocusByProjectMap(weekSessions, projects, tasks).entries()]
    .map(([projectId, minutes]) => {
      const project = projectId ? projects.find((item) => item.id === projectId) ?? null : null;
      return { projectId, name: project?.name ?? "Uncategorized", emoji: project?.emoji ?? null, minutes };
    })
    .sort((left, right) => right.minutes - left.minutes);
  const focusByTask = [...getFocusByTaskMap(weekSessions, tasks).entries()]
    .map(([taskId, minutes]) => {
      const task = taskId ? tasks.find((item) => item.id === taskId) ?? null : null;
      return { taskId, title: task?.title ?? "Unlinked focus", emoji: task?.emoji ?? null, minutes };
    })
    .sort((left, right) => right.minutes - left.minutes)
    .slice(0, 5);

  return {
    focusMinutes,
    completedSessions: completedSessions.length,
    averageSessionMinutes: completedSessions.length > 0 ? Math.round(focusMinutes / completedSessions.length) : 0,
    bestFocusDay: getBestFocusDay(weekSessions, range),
    focusByProject,
    focusByTask,
  };
}

export function calculateProjectHealth(project: Project, tasks: Task[], sessions: FocusSession[], range: WeekRange): WeeklyProjectSummary {
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  const completedTasks = projectTasks.filter((task) => task.status === "done" && isWithinWeek(getCompletedDateId(task), range)).length;
  const focusMinutes = sessions
    .filter((session) => resolveFocusSessionProjectId(session, tasks) === project.id && isWithinWeek(session.dailyPlanDate, range))
    .reduce((sum, session) => sum + getCompletedFocusMinutes(session), 0);
  const openTasks = projectTasks.filter((task) => task.status !== "done" && task.status !== "archived").length;
  const overdueHigh = projectTasks.some((task) => task.dueDate && task.dueDate < todayDateId() && (task.priority === "urgent" || task.priority === "high") && task.status !== "done" && task.status !== "archived");
  const lastActivityDate = getLastProjectActivityDate(projectTasks, sessions.filter((session) => resolveFocusSessionProjectId(session, tasks) === project.id));
  const daysSinceActivity = lastActivityDate ? diffDays(lastActivityDate, todayDateId()) : 999;
  const hadActivity = completedTasks > 0 || focusMinutes > 0;
  let health: ProjectHealthStatus = "healthy";
  let reason = "Had completed tasks or focus time this week.";

  if (project.status === "paused" || project.status === "archived") {
    health = "paused";
    reason = "Project is paused or archived.";
  } else if (overdueHigh || daysSinceActivity >= 14) {
    health = "stuck";
    reason = overdueHigh ? "High-priority overdue work is still open." : "No activity for 14+ days.";
  } else if (!hadActivity && daysSinceActivity >= 7) {
    health = "at-risk";
    reason = "No completed task or focus session in 7+ days.";
  }

  return { project, openTasks, completedTasks, focusMinutes, lastActivityDate, health, reason };
}

export function generateWeeklyInsights({
  stats,
  projectSummaries,
  tasks,
}: {
  stats: WeeklyReviewStats;
  projectSummaries: WeeklyProjectSummary[];
  tasks: Task[];
}): WeeklyInsightMessage[] {
  const messages: WeeklyInsightMessage[] = [];
  const highOpen = tasks.filter((task) => (task.priority === "urgent" || task.priority === "high") && task.status !== "done" && task.status !== "archived").length;
  const stuckProject = projectSummaries.find((project) => project.health === "stuck" || project.health === "at-risk");

  if (stats.focusMinutes >= 300) {
    messages.push({ id: "strong-focus", title: "Strong focus week", message: "You protected at least 5 hours for deep work.", severity: "success" });
  } else if (stats.focusMinutes === 0) {
    messages.push({ id: "no-focus", title: "No focus sessions", message: "Start next week with one 25-minute focus block.", severity: "warning" });
  }

  if (stats.completedTasks === 0) {
    messages.push({ id: "no-completions", title: "No completed tasks", message: "Choose one small daily action next week.", severity: "warning" });
  }

  if (stats.habitCompletionRate !== null && stats.habitCompletionRate >= 80) {
    messages.push({ id: "stable-habits", title: "Habits were stable", message: `Habit completion reached ${stats.habitCompletionRate}%.`, severity: "success" });
  } else if (stats.habitCompletionRate !== null && stats.habitCompletionRate < 40) {
    messages.push({ id: "heavy-habits", title: "Habit system may be too heavy", message: `Habit completion was ${stats.habitCompletionRate}%. Reduce before adding more.`, severity: "warning" });
  }

  if (stats.overdueTasks > 5) {
    messages.push({ id: "overdue-heavy", title: "Overdue list is growing", message: `${stats.overdueTasks} tasks are overdue. Delete, delay, or simplify low-value work.`, severity: "danger" });
  }

  if (stuckProject) {
    messages.push({ id: "project-stuck", title: `${stuckProject.project.name} needs a next step`, message: stuckProject.reason, severity: stuckProject.health === "stuck" ? "danger" : "warning" });
  }

  if (highOpen > 0) {
    messages.push({ id: "high-open", title: "High-priority work remains", message: `${highOpen} urgent/high task${highOpen === 1 ? "" : "s"} are still open. Avoid filling next week with low-value tasks.`, severity: "warning" });
  }

  return messages.slice(0, 6);
}

export function getWeeklyChartData(tasks: Task[], sessions: FocusSession[], habits: Habit[], projects: Project[], range: WeekRange) {
  const completedTasks = getCompletedTasksForWeek(tasks, range);
  const focusSessions = getFocusSessionsForWeek(sessions, range).filter((session) => session.status === "completed");
  const habitSummaries = getHabitStatsForWeek(habits, range);
  const focusByProject = calculateWeeklyFocusSummary(sessions, projects, tasks, range).focusByProject;
  const completedByProject = getCompletedByProject(completedTasks, projects);

  return {
    completedTasksByDay: range.days.map((dateId) => ({ label: formatDayLabel(dateId), value: completedTasks.filter((task) => getCompletedDateId(task) === dateId).length })),
    focusMinutesByDay: range.days.map((dateId) => ({ label: formatDayLabel(dateId), value: focusSessions.filter((session) => session.dailyPlanDate === dateId).reduce((sum, session) => sum + getCompletedFocusMinutes(session), 0) })),
    habitCompletionByDay: range.days.map((dateId) => ({ label: formatDayLabel(dateId), value: habits.length > 0 ? Math.round((habits.filter((habit) => habit.completionDates.includes(dateId)).length / habits.length) * 100) : 0 })),
    focusByProject: focusByProject.map((item) => ({ label: item.name, value: item.minutes })),
    completedByProject,
    habitSummaries,
  };
}

export function synthesizeDailyReflections(plans: DailyPlan[], range: WeekRange): DailyReflectionSynthesis {
  const weekPlans = getDailyPlansForWeek(plans, range);
  const reflectedPlans = weekPlans.filter((plan) => {
    const reflection = plan.reflection;
    return Boolean(reflection.wentWell || reflection.distractions || reflection.improveTomorrow || reflection.energyLevel || reflection.mood);
  });
  const energy = mostCommon(reflectedPlans.map((plan) => plan.reflection.energyLevel).filter(Boolean) as string[]);
  const mood = mostCommon(reflectedPlans.map((plan) => plan.reflection.mood).filter(Boolean) as string[]);

  return {
    daysWithReflections: reflectedPlans.length,
    energySummary: energy ? `Most common energy: ${energy}.` : "No energy pattern recorded.",
    moodSummary: mood ? `Most common mood: ${mood}.` : "No mood pattern recorded.",
    distractions: reflectedPlans.map((plan) => plan.reflection.distractions).filter(Boolean).slice(0, 4),
    improvements: reflectedPlans.map((plan) => plan.reflection.improveTomorrow).filter(Boolean).slice(0, 4),
  };
}

export function getProjectActionLabel(action: WeeklyProjectAction | undefined) {
  if (action === "continue") return "Continue next week";
  if (action === "pause") return "Pause";
  if (action === "cleanup") return "Needs cleanup";
  return "Not marked";
}

function getTouchedProjectIds(tasks: Task[], sessions: FocusSession[], range: WeekRange) {
  const ids = new Set<string>();
  getCompletedTasksForWeek(tasks, range).forEach((task) => {
    if (task.projectId) ids.add(task.projectId);
  });
  getFocusSessionsForWeek(sessions, range).forEach((session) => {
    const projectId = resolveFocusSessionProjectId(session, tasks);
    if (projectId && getCompletedFocusMinutes(session) > 0) ids.add(projectId);
  });
  return ids;
}

function getTopProjectByFocus(sessions: FocusSession[], projects: Project[], tasks: Task[], range: WeekRange) {
  const map = getFocusByProjectMap(getFocusSessionsForWeek(sessions, range), projects, tasks);
  const [projectId, minutes] = [...map.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];
  if (!projectId || !minutes) return "None";
  return projects.find((project) => project.id === projectId)?.name ?? "Uncategorized";
}

function getFocusByProjectMap(sessions: FocusSession[], _projects: Project[], tasks: Task[]) {
  return sessions.reduce<Map<string | null, number>>((map, session) => {
    const minutes = getCompletedFocusMinutes(session);
    if (minutes <= 0) return map;
    const projectId = resolveFocusSessionProjectId(session, tasks);
    map.set(projectId, (map.get(projectId) ?? 0) + minutes);
    return map;
  }, new Map());
}

function getFocusByTaskMap(sessions: FocusSession[], _tasks: Task[]) {
  return sessions.reduce<Map<string | null, number>>((map, session) => {
    const minutes = getCompletedFocusMinutes(session);
    if (minutes <= 0) return map;
    map.set(session.taskId, (map.get(session.taskId) ?? 0) + minutes);
    return map;
  }, new Map());
}

function getBestFocusDay(sessions: FocusSession[], range: WeekRange) {
  const best = range.days
    .map((dateId) => ({ dateId, minutes: sessions.filter((session) => session.dailyPlanDate === dateId).reduce((sum, session) => sum + getCompletedFocusMinutes(session), 0) }))
    .sort((left, right) => right.minutes - left.minutes)[0];
  return best && best.minutes > 0 ? `${formatDayLabel(best.dateId)} (${best.minutes} min)` : "No focus day yet";
}

function getTopTagByCompleted(tasks: Task[]) {
  const counts = tasks.flatMap((task) => task.tags).reduce<Record<string, number>>((map, tag) => {
    map[tag] = (map[tag] ?? 0) + 1;
    return map;
  }, {});
  const [tag] = Object.entries(counts).sort((left, right) => right[1] - left[1])[0] ?? [];
  return tag ? `#${tag}` : "None";
}

function getCompletedByProject(tasks: Task[], projects: Project[]) {
  const map = tasks.reduce<Map<string, number>>((counts, task) => {
    const key = task.projectId ?? "none";
    counts.set(key, (counts.get(key) ?? 0) + 1);
    return counts;
  }, new Map());
  return [...map.entries()]
    .map(([projectId, value]) => ({
      label: projects.find((project) => project.id === projectId)?.name ?? "Uncategorized",
      value,
    }))
    .sort((left, right) => right.value - left.value);
}

function getLastProjectActivityDate(tasks: Task[], sessions: FocusSession[]) {
  return [
    ...tasks.map((task) => getCompletedDateId(task) || getDateIdFromTimestampLike(task.updatedAt) || getDateIdFromTimestampLike(task.createdAt)),
    ...sessions.map((session) => session.completedAt?.slice(0, 10) || session.dailyPlanDate),
  ]
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? "";
}

function getCompletedDateId(task: Task) {
  return getDateIdFromTimestampLike(task.completedAt) || getDateIdFromTimestampLike(task.updatedAt) || task.dueDate || "";
}

export function getDateIdFromTimestampLike(value: { toDate?: () => Date } | string | null) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const date = value.toDate?.();
  return date && !Number.isNaN(date.getTime()) ? toDateId(date) : "";
}

function mostCommon(values: string[]) {
  const counts = values.reduce<Record<string, number>>((map, value) => {
    map[value] = (map[value] ?? 0) + 1;
    return map;
  }, {});
  return Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? "";
}

function isWithinWeek(dateId: string, range: WeekRange) {
  return Boolean(dateId && dateId >= range.startDate && dateId <= range.endDate);
}

function todayDateId() {
  return toDateId(new Date());
}

function parseDateId(dateId: string) {
  return new Date(`${dateId}T00:00:00Z`);
}

function toDateId(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function diffDays(startDate: string, endDate: string) {
  return Math.max(0, Math.round((parseDateId(endDate).getTime() - parseDateId(startDate).getTime()) / MS_PER_DAY));
}

function formatDate(dateId: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(parseDateId(dateId));
}

function formatDayLabel(dateId: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(parseDateId(dateId));
}
