import type { ChartDatum, DailyPlan, FocusSession, InsightMessage, Project, TagCount, Task } from "./types";
import { getDueDateGroup } from "./filterUtils";
import { getTodayDateId } from "./todayUtils";

export function getLast7Days(referenceDateId = getTodayDateId()) {
  const [year, month, day] = referenceDateId.split("-").map(Number);
  const reference = new Date(year, month - 1, day);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(reference);
    date.setDate(reference.getDate() - (6 - index));
    return {
      id: toDateId(date),
      label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
    };
  });
}

export function getCompletedTasksByDay(tasks: Task[], days = getLast7Days()): ChartDatum[] {
  return days.map((day) => ({
    label: day.label,
    value: tasks.filter((task) => task.status === "done" && getDateIdFromTimestampLike(task.completedAt) === day.id).length,
  }));
}

export function getFocusMinutesByDay(sessions: FocusSession[], days = getLast7Days()): ChartDatum[] {
  return days.map((day) => ({
    label: day.label,
    value: Math.round(
      sessions
        .filter((session) => session.status === "completed" && session.dailyPlanDate === day.id)
        .reduce((total, session) => total + Number(session.actualMinutes || 0), 0)
    ),
  }));
}

export function getFocusMinutesByProject(sessions: FocusSession[], projects: Project[], days = getLast7Days()): ChartDatum[] {
  const dayIds = new Set(days.map((day) => day.id));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const totals = sessions
    .filter((session) => session.status === "completed" && session.projectId && dayIds.has(session.dailyPlanDate))
    .reduce<Record<string, number>>((acc, session) => {
      if (session.projectId) {
        acc[session.projectId] = (acc[session.projectId] ?? 0) + Number(session.actualMinutes || 0);
      }
      return acc;
    }, {});

  return Object.entries(totals)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([projectId, value]) => {
      const project = projectById.get(projectId);
      return {
        label: project?.emoji ? `${project.emoji} ${project.name}` : project?.name ?? "Unknown project",
        value: Math.round(value),
        color: project?.color,
      };
    });
}

export function getOpenTasksByPriority(tasks: Task[]): ChartDatum[] {
  const priorities = ["urgent", "high", "medium", "low"] as const;
  return priorities.map((priority) => ({
    label: priority,
    value: tasks.filter((task) => task.priority === priority && task.status !== "done" && task.status !== "archived").length,
  }));
}

export function getOpenTasksByTag(tagCounts: TagCount[]): ChartDatum[] {
  return tagCounts
    .filter((tag) => tag.openTasks > 0)
    .slice(0, 8)
    .map((tag) => ({
      label: `#${tag.tag}`,
      value: tag.openTasks,
    }));
}

export function getOverdueTasks(tasks: Task[]) {
  return tasks.filter((task) => task.status !== "done" && task.status !== "archived" && getDueDateGroup(task.dueDate) === "overdue");
}

export function getProjectsWithNoRecentProgress(projects: Project[], tasks: Task[], sessions: FocusSession[], days = getLast7Days()) {
  const dayIds = new Set(days.map((day) => day.id));
  return projects.filter((project) => {
    if (project.status === "archived" || project.status === "completed") {
      return false;
    }

    const hasCompletedTask = tasks.some(
      (task) => task.projectId === project.id && task.status === "done" && dayIds.has(getDateIdFromTimestampLike(task.completedAt))
    );
    const hasFocusSession = sessions.some(
      (session) => session.projectId === project.id && session.status === "completed" && dayIds.has(session.dailyPlanDate)
    );
    return !hasCompletedTask && !hasFocusSession;
  });
}

export function generateInsightMessages({
  tasks,
  projects,
  sessions,
  dailyPlan,
  tagCounts,
  todayDateId,
}: {
  tasks: Task[];
  projects: Project[];
  sessions: FocusSession[];
  dailyPlan: DailyPlan;
  tagCounts: TagCount[];
  todayDateId: string;
}): InsightMessage[] {
  const focusMinutesToday = getFocusMinutesByDay(sessions, [{ id: todayDateId, label: "Today" }])[0]?.value ?? 0;
  const overdueTasks = getOverdueTasks(tasks);
  const plannedTasksToday = tasks.filter((task) => task.status === "today").length;
  const completedToday = tasks.filter((task) => task.status === "done" && getDateIdFromTimestampLike(task.completedAt) === todayDateId).length;
  const highPriorityOpen = tasks.filter((task) => (task.priority === "high" || task.priority === "urgent") && task.status !== "done" && task.status !== "archived");
  const top3Done = dailyPlan.topTaskIds.filter((taskId) => tasks.find((task) => task.id === taskId)?.status === "done").length;
  const lowPriorityDoneToday = tasks.filter(
    (task) => task.priority === "low" && task.status === "done" && getDateIdFromTimestampLike(task.completedAt) === todayDateId
  ).length;
  const stuckProjects = getProjectsWithNoRecentProgress(projects, tasks, sessions).slice(0, 2);
  const focusByProject = getFocusMinutesByProject(sessions, projects);
  const messages: InsightMessage[] = [];

  if (focusMinutesToday >= 90) {
    messages.push({
      id: "strong-focus-day",
      title: "Strong focus day",
      message: "You protected serious deep work time today.",
      severity: "success",
    });
  } else if (focusMinutesToday === 0) {
    messages.push({
      id: "no-focus-today",
      title: "No focus sessions yet",
      message: "Start with one 25-minute block before the day gets noisy.",
      severity: "warning",
    });
  }

  if (overdueTasks.length > 5) {
    messages.push({
      id: "overdue-heavy",
      title: "Overdue list is getting heavy",
      message: "Consider rescheduling or deleting low-value tasks.",
      severity: "danger",
    });
  }

  if (plannedTasksToday > 6 && completedToday < 2) {
    messages.push({
      id: "over-planning",
      title: "You may be over-planning",
      message: "Tomorrow, choose fewer tasks and protect the first one.",
      severity: "warning",
    });
  }

  if (highPriorityOpen.length > 0) {
    messages.push({
      id: "high-priority-open",
      title: "Important work is still open",
      message: "Pick one high-priority task before clearing low-priority work.",
      severity: "info",
    });
  }

  if (top3Done === 3 && dailyPlan.topTaskIds.length === 3) {
    messages.push({
      id: "top3-complete",
      title: "Top 3 complete",
      message: "Excellent: all Top 3 priorities are complete.",
      severity: "success",
    });
  }

  if (lowPriorityDoneToday >= 3 && highPriorityOpen.length > 0) {
    messages.push({
      id: "easy-task-avoidance",
      title: "Check task quality",
      message: "You may be clearing easy tasks while avoiding important ones.",
      severity: "warning",
    });
  }

  stuckProjects.forEach((project) => {
    messages.push({
      id: `stuck-${project.id}`,
      title: `${project.emoji ? `${project.emoji} ` : ""}${project.name} may be stuck`,
      message: "Choose one small next action or schedule a short focus block.",
      severity: "warning",
    });
  });

  if (focusByProject.length > 0) {
    messages.push({
      id: "project-real-attention",
      title: `${focusByProject[0].label} is getting attention`,
      message: "This project has focus minutes this week, not just planning.",
      severity: "success",
    });
  }

  if (tagCounts.length > 0 && tagCounts[0].openTasks >= 5) {
    messages.push({
      id: "tag-load",
      title: `${tagCounts[0].tag} is carrying load`,
      message: `You have ${tagCounts[0].openTasks} open tasks under #${tagCounts[0].tag}.`,
      severity: "info",
    });
  }

  return messages.slice(0, 5);
}

export function formatInsightNumber(value: number) {
  return new Intl.NumberFormat().format(Math.round(value));
}

export function getDateIdFromTimestampLike(value: { toDate?: () => Date } | string | null) {
  if (!value) {
    return "";
  }

  const date = typeof value === "string" ? new Date(value) : value.toDate?.();
  if (!date || Number.isNaN(date.getTime())) {
    return "";
  }

  return toDateId(date);
}

function toDateId(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
