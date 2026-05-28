import type {
  AnalyticsRange,
  AreaPerformance,
  ChartDatum,
  DailyPlan,
  DateBucket,
  FocusSession,
  InsightMessage,
  PerformanceRecommendation,
  PerformanceStatus,
  PlannedVsCompletedStats,
  PriorityCompletionStats,
  Project,
  ProjectArea,
  ProjectPerformance,
  TagCount,
  TagPerformanceStats,
  Task,
  TaskPriority,
} from "./types";
import { getDueDateGroup } from "./filterUtils";
import { getCompletedFocusMinutes, resolveFocusSessionProjectId } from "./focusUtils";
import { getTodayDateId } from "./todayUtils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const priorities: TaskPriority[] = ["urgent", "high", "medium", "low"];
const areaOrder: Array<ProjectArea | "Uncategorized"> = ["Study", "Business", "Health", "Client Work", "Personal", "Other", "Uncategorized"];

export type AnalyticsDateRange = {
  range: AnalyticsRange;
  startDate: string;
  endDate: string;
  label: string;
  bucketKind: "day" | "week" | "month";
};

export function getDateRange({
  range,
  todayDateId = getTodayDateId(),
  customStart,
  customEnd,
  tasks = [],
  sessions = [],
  dailyPlans = [],
}: {
  range: AnalyticsRange;
  todayDateId?: string;
  customStart?: string;
  customEnd?: string;
  tasks?: Task[];
  sessions?: FocusSession[];
  dailyPlans?: DailyPlan[];
}): AnalyticsDateRange {
  const today = parseDateId(todayDateId);
  let start = todayDateId;
  let end = todayDateId;
  let label = "Today";

  if (range === "7-days") {
    start = toDateId(addDays(today, -6));
    label = "Last 7 days";
  } else if (range === "30-days") {
    start = toDateId(addDays(today, -29));
    label = "Last 30 days";
  } else if (range === "this-month") {
    start = toDateId(new Date(today.getFullYear(), today.getMonth(), 1));
    label = "This month";
  } else if (range === "this-year") {
    start = toDateId(new Date(today.getFullYear(), 0, 1));
    label = "This year";
  } else if (range === "all-time") {
    start = getEarliestKnownDateId(tasks, sessions, dailyPlans, todayDateId);
    label = "All time";
  } else if (range === "custom") {
    start = isDateId(customStart) ? customStart : toDateId(addDays(today, -6));
    end = isDateId(customEnd) ? customEnd : todayDateId;
    label = "Custom range";
  }

  if (start > end) {
    [start, end] = [end, start];
  }

  const days = diffDays(start, end) + 1;
  const bucketKind =
    range === "this-year" || range === "all-time"
      ? "month"
      : range === "this-month"
        ? "week"
        : range === "30-days"
          ? "day"
          : range === "custom"
            ? days > 120
              ? "month"
              : days > 45
                ? "week"
                : "day"
            : "day";
  return {
    range,
    startDate: start,
    endDate: end,
    label,
    bucketKind,
  };
}

export function getLast7Days(referenceDateId = getTodayDateId()) {
  return getDailyBuckets({
    range: "7-days",
    startDate: toDateId(addDays(parseDateId(referenceDateId), -6)),
    endDate: referenceDateId,
    label: "Last 7 days",
    bucketKind: "day",
  });
}

export function getDateBucket(dateId: string, buckets: DateBucket[]) {
  return buckets.find((bucket) => dateId >= bucket.startDate && dateId <= bucket.endDate) ?? null;
}

export function getDailyBuckets(range: AnalyticsDateRange): DateBucket[] {
  const buckets: DateBucket[] = [];
  const start = parseDateId(range.startDate);
  const end = parseDateId(range.endDate);
  const dayCount = diffDays(range.startDate, range.endDate);

  for (let index = 0; index <= dayCount; index += 1) {
    const date = addDays(start, index);
    const id = toDateId(date);
    buckets.push({
      id,
      label: dayCount <= 8 ? new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date) : formatDateLabel(id),
      startDate: id,
      endDate: id,
    });
  }

  return buckets;
}

export function getWeeklyBuckets(range: AnalyticsDateRange): DateBucket[] {
  const buckets: DateBucket[] = [];
  let cursor = parseDateId(range.startDate);
  const end = parseDateId(range.endDate);

  while (cursor <= end) {
    const bucketStart = toDateId(cursor);
    const bucketEnd = toDateId(minDate(addDays(cursor, 6), end));
    buckets.push({
      id: bucketStart,
      label: `Week of ${formatDateLabel(bucketStart)}`,
      startDate: bucketStart,
      endDate: bucketEnd,
    });
    cursor = addDays(cursor, 7);
  }

  return buckets;
}

export function getMonthlyBuckets(range: AnalyticsDateRange): DateBucket[] {
  const buckets: DateBucket[] = [];
  const start = parseDateId(range.startDate);
  const end = parseDateId(range.endDate);
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const monthStart = maxDate(cursor, start);
    const monthEnd = minDate(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0), end);
    const id = toDateId(monthStart);
    buckets.push({
      id,
      label: new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(cursor),
      startDate: id,
      endDate: toDateId(monthEnd),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return buckets;
}

export function getRangeBuckets(range: AnalyticsDateRange): DateBucket[] {
  if (range.bucketKind === "month") {
    return getMonthlyBuckets(range);
  }

  if (range.bucketKind === "week") {
    return getWeeklyBuckets(range);
  }

  return getDailyBuckets(range);
}

export function getTasksInRange(tasks: Task[], range: AnalyticsDateRange) {
  return tasks.filter((task) => {
    const dates = [getDateIdFromTimestampLike(task.createdAt), getDateIdFromTimestampLike(task.updatedAt), task.dueDate, getDateIdFromTimestampLike(task.completedAt)].filter(Boolean);
    return dates.some((dateId) => isWithinRange(dateId, range));
  });
}

export function getFocusSessionsInRange(sessions: FocusSession[], range: AnalyticsDateRange) {
  return sessions.filter((session) => isWithinRange(session.dailyPlanDate, range));
}

export function getCompletedTasksInRange(tasks: Task[], range: AnalyticsDateRange) {
  return tasks.filter((task) => task.status === "done" && isWithinRange(getCompletedDateId(task), range));
}

export function getFocusMinutesInRange(sessions: FocusSession[], range: AnalyticsDateRange) {
  return getFocusSessionsInRange(sessions, range)
    .filter((session) => session.status === "completed")
    .reduce((total, session) => total + getCompletedFocusMinutes(session), 0);
}

export function getCompletedTasksByDay(tasks: Task[], days: DateBucket[] = getLast7Days()): ChartDatum[] {
  return days.map((day) => ({
    label: day.label,
    value: tasks.filter((task) => task.status === "done" && getDateBucket(getCompletedDateId(task), [day])).length,
    detail: `${day.startDate}${day.startDate === day.endDate ? "" : ` to ${day.endDate}`}`,
  }));
}

export function getFocusMinutesByDay(sessions: FocusSession[], days: DateBucket[] = getLast7Days()): ChartDatum[] {
  return days.map((day) => ({
    label: day.label,
    value: Math.round(
      sessions
        .filter((session) => session.status === "completed" && getDateBucket(session.dailyPlanDate, [day]))
        .reduce((total, session) => total + getCompletedFocusMinutes(session), 0)
    ),
    detail: `${day.startDate}${day.startDate === day.endDate ? "" : ` to ${day.endDate}`}`,
  }));
}

export function getFocusMinutesByProject(sessions: FocusSession[], projects: Project[], days: DateBucket[] = getLast7Days(), tasks: Task[] = []): ChartDatum[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const uncategorizedId = "uncategorized";
  const totals = sessions
    .filter((session) => session.status === "completed" && days.some((day) => getDateBucket(session.dailyPlanDate, [day])) && getCompletedFocusMinutes(session) > 0)
    .reduce<Record<string, number>>((acc, session) => {
      const projectId = resolveFocusSessionProjectId(session, tasks) ?? uncategorizedId;
      acc[projectId] = (acc[projectId] ?? 0) + getCompletedFocusMinutes(session);
      return acc;
    }, {});

  return Object.entries(totals)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([projectId, value]) => {
      const project = projectById.get(projectId);
      return {
        label: projectId === uncategorizedId ? "Uncategorized" : project?.emoji ? `${project.emoji} ${project.name}` : project?.name ?? "Unknown project",
        value: Math.round(value),
        color: project?.color,
        detail: `${Math.round(value)} focused minutes`,
      };
    });
}

export function getFocusByProject(sessions: FocusSession[], projects: Project[], range: AnalyticsDateRange, tasks: Task[] = []): ChartDatum[] {
  const buckets = getRangeBuckets(range);
  const data = getFocusMinutesByProject(sessions, projects, buckets, tasks);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return data.map((item) => ({
    ...item,
    detail: total > 0 ? `${item.value} min, ${Math.round((item.value / total) * 100)}% of focus` : `${item.value} min`,
  }));
}

export function getTaskCompletionByProject(tasks: Task[], projects: Project[], range: AnalyticsDateRange): ChartDatum[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const grouped = new Map<string, { label: string; color?: string; completed: number; open: number }>();

  for (const project of projects) {
    grouped.set(project.id, {
      label: project.emoji ? `${project.emoji} ${project.name}` : project.name,
      color: project.color,
      completed: 0,
      open: 0,
    });
  }
  grouped.set("none", { label: "Uncategorized", completed: 0, open: 0 });

  for (const task of tasks) {
    const key = task.projectId && projectById.has(task.projectId) ? task.projectId : "none";
    const bucket = grouped.get(key) ?? grouped.get("none");
    if (!bucket) {
      continue;
    }

    if (task.status === "done" && isWithinRange(getCompletedDateId(task), range)) {
      bucket.completed += 1;
    } else if (task.status !== "done" && task.status !== "archived") {
      bucket.open += 1;
    }
  }

  return [...grouped.values()]
    .filter((item) => item.completed > 0 || item.open > 0)
    .sort((left, right) => right.completed + right.open - (left.completed + left.open))
    .slice(0, 10)
    .map((item) => ({
      label: item.label,
      value: item.completed,
      color: item.color,
      detail: `${item.completed} completed, ${item.open} open`,
    }));
}

export function getTaskCompletionByArea(tasks: Task[], projects: Project[], range: AnalyticsDateRange): ChartDatum[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const grouped = createAreaAccumulator();

  for (const task of tasks) {
    const area = getTaskArea(task, projectById);
    if (task.status === "done" && isWithinRange(getCompletedDateId(task), range)) {
      grouped[area].completed += 1;
    } else if (task.status !== "done" && task.status !== "archived") {
      grouped[area].open += 1;
    }
  }

  return areaOrder
    .map((area) => ({
      label: area,
      value: grouped[area].completed,
      detail: `${grouped[area].completed} completed, ${grouped[area].open} open`,
    }))
    .filter((item) => item.value > 0 || !item.detail.startsWith("0 completed, 0 open"));
}

export function getOpenTasksByArea(tasks: Task[], projects: Project[]): ChartDatum[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const grouped = createAreaAccumulator();
  tasks
    .filter((task) => task.status !== "done" && task.status !== "archived")
    .forEach((task) => {
      grouped[getTaskArea(task, projectById)].open += 1;
    });

  return areaOrder
    .map((area) => ({
      label: area,
      value: grouped[area].open,
      detail: `${grouped[area].open} open tasks`,
    }))
    .filter((item) => item.value > 0);
}

export function getOverdueTasksByProject(tasks: Task[], projects: Project[]): ChartDatum[] {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const totals = new Map<string, { label: string; color?: string; value: number }>();

  for (const task of getOverdueTasks(tasks)) {
    const project = task.projectId ? projectById.get(task.projectId) ?? null : null;
    const id = project?.id ?? "none";
    const existing = totals.get(id) ?? {
      label: project ? (project.emoji ? `${project.emoji} ${project.name}` : project.name) : "Uncategorized",
      color: project?.color,
      value: 0,
    };
    existing.value += 1;
    totals.set(id, existing);
  }

  return [...totals.values()]
    .sort((left, right) => right.value - left.value)
    .map((item) => ({ ...item, detail: `${item.value} overdue tasks` }));
}

export function getOverdueTrend(tasks: Task[], buckets: DateBucket[]): ChartDatum[] {
  const openTasks = tasks.filter((task) => task.status !== "done" && task.status !== "archived" && task.dueDate);
  return buckets.map((bucket) => {
    const bucketEnd = bucket.endDate;
    const value = openTasks.filter((task) => task.dueDate <= bucketEnd && getDueDateGroup(task.dueDate) === "overdue").length;
    return {
      label: bucket.label,
      value,
      detail: `${value} currently overdue by ${bucket.label}`,
    };
  });
}

export function getPriorityCompletionStats(tasks: Task[], range: AnalyticsDateRange): PriorityCompletionStats[] {
  return priorities.map((priority) => ({
    priority,
    completed: tasks.filter((task) => task.priority === priority && task.status === "done" && isWithinRange(getCompletedDateId(task), range)).length,
    open: tasks.filter((task) => task.priority === priority && task.status !== "done" && task.status !== "archived").length,
    overdue: tasks.filter((task) => task.priority === priority && task.status !== "done" && task.status !== "archived" && getDueDateGroup(task.dueDate) === "overdue").length,
  }));
}

export function getPlannedVsCompletedStats(tasks: Task[], dailyPlans: DailyPlan[], range: AnalyticsDateRange): PlannedVsCompletedStats {
  const plansInRange = dailyPlans.filter((plan) => isWithinRange(plan.date, range));
  const completed = getCompletedTasksInRange(tasks, range).length;
  const plannedTaskIds = new Set<string>();
  let timeBlocksPlanned = 0;
  let timeBlocksCompleted = 0;
  let topThreeCompleted = 0;

  for (const plan of plansInRange) {
    plan.topTaskIds.forEach((taskId) => plannedTaskIds.add(taskId));
    topThreeCompleted += plan.topTaskIds.filter((taskId) => tasks.find((task) => task.id === taskId)?.status === "done").length;
    timeBlocksPlanned += plan.timeBlocks.length;
    timeBlocksCompleted += plan.timeBlocks.filter((block) => block.completed).length;
  }

  const planned = Math.max(plannedTaskIds.size, tasks.filter((task) => task.status === "today").length);

  return {
    planned,
    completed,
    topThreePlanned: plansInRange.reduce((total, plan) => total + plan.topTaskIds.length, 0),
    topThreeCompleted,
    timeBlocksPlanned,
    timeBlocksCompleted,
  };
}

export function getTagPerformance(tasks: Task[], range: AnalyticsDateRange): TagPerformanceStats[] {
  const tags = new Map<string, TagPerformanceStats>();

  for (const task of tasks) {
    for (const tag of task.tags) {
      const existing = tags.get(tag) ?? {
        tag,
        openTasks: 0,
        completedTasks: 0,
        totalTasks: 0,
      };

      if (task.status === "done" && isWithinRange(getCompletedDateId(task), range)) {
        existing.completedTasks += 1;
      } else if (task.status !== "done" && task.status !== "archived") {
        existing.openTasks += 1;
      }

      existing.totalTasks += 1;
      tags.set(tag, existing);
    }
  }

  return [...tags.values()]
    .filter((tag) => tag.openTasks > 0 || tag.completedTasks > 0)
    .sort((left, right) => right.openTasks + right.completedTasks - (left.openTasks + left.completedTasks));
}

export function getOpenTasksByPriority(tasks: Task[]): ChartDatum[] {
  return priorities.map((priority) => ({
    label: priority,
    value: tasks.filter((task) => task.priority === priority && task.status !== "done" && task.status !== "archived").length,
    detail: `${priority} priority open tasks`,
  }));
}

export function getOpenTasksByTag(tagCounts: TagCount[]): ChartDatum[] {
  return tagCounts
    .filter((tag) => tag.openTasks > 0)
    .slice(0, 8)
    .map((tag) => ({
      label: `#${tag.tag}`,
      value: tag.openTasks,
      detail: `${tag.openTasks} open, ${tag.completedTasks} completed`,
    }));
}

export function getOverdueTasks(tasks: Task[]) {
  return tasks.filter((task) => task.status !== "done" && task.status !== "archived" && getDueDateGroup(task.dueDate) === "overdue");
}

export function getProjectsWithNoRecentProgress(projects: Project[], tasks: Task[], sessions: FocusSession[], days: DateBucket[] = getLast7Days()) {
  return projects.filter((project) => {
    if (project.status === "archived" || project.status === "completed") {
      return false;
    }

    const hasCompletedTask = tasks.some(
      (task) => task.projectId === project.id && task.status === "done" && days.some((day) => getDateBucket(getCompletedDateId(task), [day]))
    );
    const hasFocusSession = sessions.some(
      (session) => session.projectId === project.id && session.status === "completed" && days.some((day) => getDateBucket(session.dailyPlanDate, [day]))
    );
    return !hasCompletedTask && !hasFocusSession;
  });
}

export function calculateProjectPerformanceScore({
  project,
  tasks,
  sessions,
  range,
  todayDateId = getTodayDateId(),
}: {
  project: Project;
  tasks: Task[];
  sessions: FocusSession[];
  range: AnalyticsDateRange;
  todayDateId?: string;
}): ProjectPerformance {
  const projectTasks = tasks.filter((task) => task.projectId === project.id);
  const completedTasks = projectTasks.filter((task) => task.status === "done" && isWithinRange(getCompletedDateId(task), range));
  const openTasks = projectTasks.filter((task) => task.status !== "done" && task.status !== "archived");
  const overdueTasks = openTasks.filter((task) => getDueDateGroup(task.dueDate) === "overdue");
  const urgentHighOpen = openTasks.filter((task) => task.priority === "urgent" || task.priority === "high").length;
  const priorityCompleted = completedTasks.filter((task) => task.priority === "urgent" || task.priority === "high").length;
  const focusMinutes = getFocusSessionsInRange(sessions, range)
    .filter((session) => resolveFocusSessionProjectId(session, tasks) === project.id && session.status === "completed")
    .reduce((total, session) => total + getCompletedFocusMinutes(session), 0);
  const lastActivityDate = getLastProjectActivityDate(project.id, tasks, sessions);
  const daysSinceActivity = lastActivityDate ? diffDays(lastActivityDate, todayDateId) : null;
  const { score, status, message } = scorePerformance({
    name: project.name,
    completedTasks: completedTasks.length,
    focusMinutes,
    openTasks: openTasks.length,
    overdueTasks: overdueTasks.length,
    urgentHighOpen,
    priorityCompleted,
    daysSinceActivity,
    rangeLabel: range.label,
  });

  return {
    projectId: project.id,
    name: project.name,
    emoji: project.emoji,
    area: project.area,
    color: project.color,
    completedTasks: completedTasks.length,
    focusMinutes,
    openTasks: openTasks.length,
    overdueTasks: overdueTasks.length,
    urgentHighOpen,
    priorityCompleted,
    lastActivityDate,
    daysSinceActivity,
    score,
    status,
    message,
  };
}

export function getProjectPerformance(
  projects: Project[],
  tasks: Task[],
  sessions: FocusSession[],
  range: AnalyticsDateRange,
  todayDateId = getTodayDateId()
) {
  return projects
    .filter((project) => project.status !== "archived")
    .map((project) => calculateProjectPerformanceScore({ project, tasks, sessions, range, todayDateId }))
    .sort((left, right) => {
      const statusWeight = statusSortWeight(left.status) - statusSortWeight(right.status);
      return statusWeight || right.focusMinutes + right.completedTasks - (left.focusMinutes + left.completedTasks);
    });
}

export function calculateAreaPerformanceScore({
  area,
  tasks,
  projects,
  sessions,
  range,
  todayDateId = getTodayDateId(),
}: {
  area: ProjectArea | "Uncategorized";
  tasks: Task[];
  projects: Project[];
  sessions: FocusSession[];
  range: AnalyticsDateRange;
  todayDateId?: string;
}): AreaPerformance {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const areaProjectIds = new Set(projects.filter((project) => project.area === area).map((project) => project.id));
  const areaTasks = tasks.filter((task) => getTaskArea(task, projectById) === area);
  const completedTasks = areaTasks.filter((task) => task.status === "done" && isWithinRange(getCompletedDateId(task), range));
  const openTasks = areaTasks.filter((task) => task.status !== "done" && task.status !== "archived");
  const overdueTasks = openTasks.filter((task) => getDueDateGroup(task.dueDate) === "overdue");
  const urgentHighOpen = openTasks.filter((task) => task.priority === "urgent" || task.priority === "high").length;
  const priorityCompleted = completedTasks.filter((task) => task.priority === "urgent" || task.priority === "high").length;
  const focusMinutes = getFocusSessionsInRange(sessions, range)
    .filter((session) => {
      const projectId = resolveFocusSessionProjectId(session, tasks);
      return session.status === "completed" && projectId && areaProjectIds.has(projectId);
    })
    .reduce((total, session) => total + getCompletedFocusMinutes(session), 0);
  const lastActivityDate = getLastAreaActivityDate(area, tasks, projects, sessions);
  const daysSinceActivity = lastActivityDate ? diffDays(lastActivityDate, todayDateId) : null;
  const { score, status, message } = scorePerformance({
    name: area,
    completedTasks: completedTasks.length,
    focusMinutes,
    openTasks: openTasks.length,
    overdueTasks: overdueTasks.length,
    urgentHighOpen,
    priorityCompleted,
    daysSinceActivity,
    rangeLabel: range.label,
  });

  return {
    area,
    emoji: getAreaEmoji(area),
    completedTasks: completedTasks.length,
    focusMinutes,
    openTasks: openTasks.length,
    overdueTasks: overdueTasks.length,
    urgentHighOpen,
    priorityCompleted,
    lastActivityDate,
    daysSinceActivity,
    score,
    status,
    message,
  };
}

export function getAreaPerformance(
  tasks: Task[],
  projects: Project[],
  sessions: FocusSession[],
  range: AnalyticsDateRange,
  todayDateId = getTodayDateId()
) {
  return areaOrder
    .map((area) => calculateAreaPerformanceScore({ area, tasks, projects, sessions, range, todayDateId }))
    .filter((area) => area.openTasks > 0 || area.completedTasks > 0 || area.focusMinutes > 0)
    .sort((left, right) => statusSortWeight(left.status) - statusSortWeight(right.status) || right.focusMinutes + right.completedTasks - (left.focusMinutes + left.completedTasks));
}

export function generatePerformanceRecommendations({
  tasks,
  projects,
  sessions,
  dailyPlans = [],
  dailyPlan,
  todayDateId,
  range,
  tagCounts = [],
}: {
  tasks: Task[];
  projects: Project[];
  sessions: FocusSession[];
  dailyPlans?: DailyPlan[];
  dailyPlan?: DailyPlan;
  todayDateId: string;
  range: AnalyticsDateRange;
  tagCounts?: TagCount[];
}): PerformanceRecommendation[] {
  const projectPerformance = getProjectPerformance(projects, tasks, sessions, range, todayDateId);
  const areaPerformance = getAreaPerformance(tasks, projects, sessions, range, todayDateId);
  const priorityStats = getPriorityCompletionStats(tasks, range);
  const planned = getPlannedVsCompletedStats(tasks, dailyPlans.length > 0 ? dailyPlans : dailyPlan ? [dailyPlan] : [], range);
  const focusByDay = getFocusMinutesByDay(sessions, getRangeBuckets(range));
  const recommendations: PerformanceRecommendation[] = [];
  const highOpen = priorityStats.find((item) => item.priority === "high")?.open ?? 0;
  const urgentOpen = priorityStats.find((item) => item.priority === "urgent")?.open ?? 0;
  const lowCompleted = priorityStats.find((item) => item.priority === "low")?.completed ?? 0;
  const highUrgentCompleted = priorityStats
    .filter((item) => item.priority === "urgent" || item.priority === "high")
    .reduce((total, item) => total + item.completed, 0);

  for (const project of projectPerformance.filter((item) => item.status === "Stuck" || item.status === "Neglected").slice(0, 2)) {
    recommendations.push({
      id: `project-${project.projectId}-${project.status}`,
      title: `${displayName(project.name, project.emoji)} ${project.status === "Stuck" ? "is stuck" : "is neglected"}`,
      message:
        project.status === "Stuck"
          ? `${project.name} has ${project.overdueTasks} overdue tasks and no recent progress. Move one task into Today's Top 3.`
          : `${project.name} has no meaningful activity in ${range.label.toLowerCase()}. Schedule one 25-minute focus block.`,
      severity: project.status === "Stuck" ? "danger" : "warning",
      action: "Pick one small next action.",
      projectId: project.projectId,
      area: project.area,
    });
  }

  const strongest = [...projectPerformance].sort((left, right) => right.focusMinutes + right.completedTasks * 20 - (left.focusMinutes + left.completedTasks * 20))[0];
  const weakest = [...projectPerformance]
    .filter((project) => project.openTasks > 0)
    .sort((left, right) => left.focusMinutes + left.completedTasks * 20 - (right.focusMinutes + right.completedTasks * 20))[0];

  if (strongest && weakest && strongest.projectId !== weakest.projectId && strongest.focusMinutes + strongest.completedTasks > weakest.focusMinutes + weakest.completedTasks) {
    recommendations.push({
      id: "attention-balance",
      title: `${weakest.name} is getting less attention`,
      message: `${weakest.name} is behind ${strongest.name} in ${range.label.toLowerCase()}. Schedule one 25-minute block before adding new work.`,
      severity: "info",
      action: "Balance attention across important areas.",
      projectId: weakest.projectId,
      area: weakest.area,
    });
  }

  if (urgentOpen + highOpen > 0 && lowCompleted > highUrgentCompleted) {
    recommendations.push({
      id: "priority-quality",
      title: "Important tasks are being delayed",
      message: `You completed ${lowCompleted} low-priority tasks while ${urgentOpen + highOpen} high or urgent tasks remain open.`,
      severity: "warning",
      action: "Complete one high-priority task before clearing easy work.",
    });
  }

  if (planned.planned > 6 && planned.completed < 2) {
    recommendations.push({
      id: "planned-too-much",
      title: "Planning load is too heavy",
      message: `You planned ${planned.planned} tasks but completed ${planned.completed}. Tomorrow, choose fewer tasks and protect the first one.`,
      severity: "warning",
      action: "Keep tomorrow's plan smaller.",
    });
  }

  const bestFocusDay = focusByDay.reduce<ChartDatum | null>((best, item) => (!best || item.value > best.value ? item : best), null);
  if (bestFocusDay && bestFocusDay.value >= 25) {
    recommendations.push({
      id: "best-focus-day",
      title: `${bestFocusDay.label} was your best focus day`,
      message: `You logged ${formatMinutes(bestFocusDay.value)} of focus. Try repeating the schedule that made it possible.`,
      severity: "success",
      action: "Repeat a proven focus window.",
    });
  }

  const healthArea = areaPerformance.find((area) => area.area === "Health");
  if (healthArea && healthArea.openTasks > 0 && healthArea.completedTasks === 0 && healthArea.focusMinutes === 0) {
    recommendations.push({
      id: "health-small-action",
      title: "Health has no activity in this range",
      message: "Add one small physical task or schedule a short health block.",
      severity: "warning",
      action: "Make the next action small.",
      area: "Health",
    });
  }

  if (dailyPlan?.topTaskIds.length === 3) {
    const top3Done = dailyPlan.topTaskIds.filter((taskId) => tasks.find((task) => task.id === taskId)?.status === "done").length;
    if (top3Done === 3) {
      recommendations.push({
        id: "top-three-complete",
        title: "Top 3 priorities are complete",
        message: "Today has a clean priority signal. Avoid adding low-value tasks just to stay busy.",
        severity: "success",
        action: "Protect the win.",
      });
    }
  }

  if (tagCounts.length > 0 && tagCounts[0].openTasks >= 5) {
    recommendations.push({
      id: "tag-heavy",
      title: `#${tagCounts[0].tag} is carrying load`,
      message: `There are ${tagCounts[0].openTasks} open tasks under #${tagCounts[0].tag}. Create a saved view or pick the next task.`,
      severity: "info",
      action: "Review the largest tag cluster.",
    });
  }

  return dedupeRecommendations(recommendations).slice(0, 8);
}

export function generateInsightMessages({
  tasks,
  projects,
  sessions,
  dailyPlan,
  dailyPlans,
  tagCounts,
  todayDateId,
}: {
  tasks: Task[];
  projects: Project[];
  sessions: FocusSession[];
  dailyPlan: DailyPlan;
  dailyPlans?: DailyPlan[];
  tagCounts: TagCount[];
  todayDateId: string;
}): InsightMessage[] {
  const range = getDateRange({ range: "7-days", todayDateId, tasks, sessions, dailyPlans: dailyPlans ?? [dailyPlan] });
  const focusMinutesToday = getFocusMinutesByDay(sessions, [{ id: todayDateId, label: "Today", startDate: todayDateId, endDate: todayDateId }])[0]?.value ?? 0;
  const overdueTasks = getOverdueTasks(tasks);
  const plannedTasksToday = tasks.filter((task) => task.status === "today").length;
  const completedToday = tasks.filter((task) => task.status === "done" && getCompletedDateId(task) === todayDateId).length;
  const messages = generatePerformanceRecommendations({
    tasks,
    projects,
    sessions,
    dailyPlans: dailyPlans ?? [dailyPlan],
    dailyPlan,
    tagCounts,
    todayDateId,
    range,
  }).map<InsightMessage>((recommendation) => ({
    id: recommendation.id,
    title: recommendation.title,
    message: recommendation.message,
    severity: recommendation.severity,
  }));

  if (focusMinutesToday >= 90) {
    messages.unshift({
      id: "strong-focus-day",
      title: "Strong focus day",
      message: "You protected serious deep work time today.",
      severity: "success",
    });
  } else if (focusMinutesToday === 0) {
    messages.unshift({
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

  return messages.filter((message, index, list) => list.findIndex((item) => item.id === message.id) === index).slice(0, 5);
}

export function formatInsightNumber(value: number) {
  return new Intl.NumberFormat().format(Math.round(value));
}

export function formatMinutes(minutes: number) {
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) {
    return `${rounded} min`;
  }

  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function formatDateLabel(dateId: string) {
  const date = parseDateId(dateId);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
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

export function toDateId(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function scorePerformance({
  name,
  completedTasks,
  focusMinutes,
  openTasks,
  overdueTasks,
  urgentHighOpen,
  priorityCompleted,
  daysSinceActivity,
  rangeLabel,
}: {
  name: string;
  completedTasks: number;
  focusMinutes: number;
  openTasks: number;
  overdueTasks: number;
  urgentHighOpen: number;
  priorityCompleted: number;
  daysSinceActivity: number | null;
  rangeLabel: string;
}): { score: number; status: PerformanceStatus; message: string } {
  const completedScore = Math.min(30, completedTasks * 6);
  const focusScore = focusMinutes >= 90 ? 30 : focusMinutes >= 25 ? 18 : focusMinutes > 0 ? 10 : 0;
  const recencyScore = daysSinceActivity === null ? 0 : daysSinceActivity <= 2 ? 20 : daysSinceActivity <= 7 ? 12 : daysSinceActivity <= 14 ? 6 : 0;
  const priorityScore = Math.min(10, priorityCompleted * 5);
  const overduePenalty = Math.min(35, overdueTasks * 7 + urgentHighOpen * 3);
  const score = Math.max(0, Math.min(100, completedScore + focusScore + recencyScore + priorityScore - overduePenalty));

  if (openTasks > 0 && overdueTasks >= 2 && (daysSinceActivity === null || daysSinceActivity >= 7)) {
    return {
      score,
      status: "Stuck",
      message: `Marked as Stuck because it has ${overdueTasks} overdue tasks and no recent progress.`,
    };
  }

  if (openTasks > 0 && completedTasks === 0 && focusMinutes === 0 && (daysSinceActivity === null || daysSinceActivity >= 7)) {
    return {
      score,
      status: "Neglected",
      message: `${name} has no completed tasks or focus minutes in ${rangeLabel.toLowerCase()}.`,
    };
  }

  if (score >= 75) {
    return {
      score,
      status: "Strong",
      message: `${name} is strong: ${completedTasks} completed tasks and ${formatMinutes(focusMinutes)} of focus.`,
    };
  }

  if (score >= 50) {
    return {
      score,
      status: "Healthy",
      message: `${name} is healthy: some recent progress and manageable overdue load.`,
    };
  }

  return {
    score,
    status: "Needs attention",
    message: openTasks > 0 ? `${name} needs attention: add a concrete next action or focus block.` : `${name} has little signal in this range.`,
  };
}

function getLastProjectActivityDate(projectId: string, tasks: Task[], sessions: FocusSession[]) {
  const dates = [
    ...tasks
      .filter((task) => task.projectId === projectId)
      .flatMap((task) => [getCompletedDateId(task), getDateIdFromTimestampLike(task.updatedAt), getDateIdFromTimestampLike(task.createdAt)]),
    ...sessions.filter((session) => resolveFocusSessionProjectId(session, tasks) === projectId && session.status === "completed").map((session) => session.dailyPlanDate),
  ].filter(Boolean);

  const sortedDates = dates.sort();
  return sortedDates[sortedDates.length - 1] ?? "";
}

function getLastAreaActivityDate(area: ProjectArea | "Uncategorized", tasks: Task[], projects: Project[], sessions: FocusSession[]) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const projectIds = new Set(projects.filter((project) => project.area === area).map((project) => project.id));
  const dates = [
    ...tasks
      .filter((task) => getTaskArea(task, projectById) === area)
      .flatMap((task) => [getCompletedDateId(task), getDateIdFromTimestampLike(task.updatedAt), getDateIdFromTimestampLike(task.createdAt)]),
    ...sessions
      .filter((session) => {
        const projectId = resolveFocusSessionProjectId(session, tasks);
        return Boolean(projectId && projectIds.has(projectId) && session.status === "completed");
      })
      .map((session) => session.dailyPlanDate),
  ].filter(Boolean);

  const sortedDates = dates.sort();
  return sortedDates[sortedDates.length - 1] ?? "";
}

function statusSortWeight(status: PerformanceStatus) {
  switch (status) {
    case "Stuck":
      return 0;
    case "Neglected":
      return 1;
    case "Needs attention":
      return 2;
    case "Healthy":
      return 3;
    case "Strong":
      return 4;
  }
}

function getCompletedDateId(task: Task) {
  return getDateIdFromTimestampLike(task.completedAt) || task.dueDate || getDateIdFromTimestampLike(task.updatedAt);
}

function getTaskArea(task: Task, projectById: Map<string, Project>): ProjectArea | "Uncategorized" {
  if (task.projectId) {
    return projectById.get(task.projectId)?.area ?? "Other";
  }

  if (task.tags.length === 0) {
    return "Uncategorized";
  }

  const tagText = task.tags.join(" ");
  if (/(german|study|uopeople|university|reading|learning)/i.test(tagText)) {
    return "Study";
  }
  if (/(seo|client|freelance)/i.test(tagText)) {
    return "Client Work";
  }
  if (/(business|money|sales|idea)/i.test(tagText)) {
    return "Business";
  }
  if (/(health|gym|fitness|discipline)/i.test(tagText)) {
    return "Health";
  }
  if (/(home|personal|family)/i.test(tagText)) {
    return "Personal";
  }

  return "Other";
}

function getAreaEmoji(area: ProjectArea | "Uncategorized") {
  switch (area) {
    case "Study":
      return "📚";
    case "Business":
      return "📈";
    case "Health":
      return "🏋️";
    case "Client Work":
      return "💼";
    case "Personal":
      return "🌱";
    case "Other":
      return "🧭";
    case "Uncategorized":
      return null;
  }
}

function createAreaAccumulator() {
  return areaOrder.reduce<Record<ProjectArea | "Uncategorized", { completed: number; open: number }>>((acc, area) => {
    acc[area] = { completed: 0, open: 0 };
    return acc;
  }, {} as Record<ProjectArea | "Uncategorized", { completed: number; open: number }>);
}

function dedupeRecommendations(recommendations: PerformanceRecommendation[]) {
  return recommendations.filter((recommendation, index, list) => list.findIndex((item) => item.id === recommendation.id) === index);
}

function displayName(name: string, emoji: string | null) {
  return emoji ? `${emoji} ${name}` : name;
}

function isWithinRange(dateId: string, range: AnalyticsDateRange) {
  return Boolean(dateId) && dateId >= range.startDate && dateId <= range.endDate;
}

function getEarliestKnownDateId(tasks: Task[], sessions: FocusSession[], dailyPlans: DailyPlan[], fallback: string) {
  const dates = [
    ...tasks.flatMap((task) => [getDateIdFromTimestampLike(task.createdAt), getDateIdFromTimestampLike(task.completedAt), task.dueDate]),
    ...sessions.map((session) => session.dailyPlanDate),
    ...dailyPlans.map((plan) => plan.date),
  ].filter(isDateId);

  return dates.sort()[0] ?? fallback;
}

function isDateId(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseDateId(dateId: string) {
  const [year, month, day] = dateId.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function minDate(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? left : right;
}

function maxDate(left: Date, right: Date) {
  return left.getTime() >= right.getTime() ? left : right;
}

function diffDays(startDateId: string, endDateId: string) {
  return Math.max(0, Math.round((parseDateId(endDateId).getTime() - parseDateId(startDateId).getTime()) / MS_PER_DAY));
}
