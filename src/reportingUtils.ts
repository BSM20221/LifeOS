import type {
  DailyPlan,
  FocusSession,
  PerformanceStatus,
  Project,
  ProjectArea,
  ReportingBucket,
  ReportingDataset,
  ReportingFilters,
  ReportingRecommendation,
  ReportingSeries,
  ReportingTableColumn,
  ReportingTableRow,
  Task,
  TaskPriority,
} from "./types";
import { getCompletedFocusMinutes, resolveFocusSessionProjectId } from "./focusUtils";
import { formatMinutes, getDateIdFromTimestampLike } from "./insightsUtils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const priorities: TaskPriority[] = ["urgent", "high", "medium", "low"];
const areaOrder: Array<ProjectArea | "Uncategorized"> = ["Study", "Business", "Health", "Client Work", "Personal", "Other", "Uncategorized"];

const palette = ["#2563EB", "#10B981", "#8B5CF6", "#F97316", "#EF4444", "#F59E0B", "#64748B", "#06B6D4", "#EC4899", "#14B8A6"];
const metricColors = {
  focus: "#2563EB",
  completed: "#10B981",
  planned: "#8B5CF6",
  topThree: "#A855F7",
  timeBlocks: "#06B6D4",
  open: "#F59E0B",
  overdue: "#EF4444",
  uncategorized: "#64748B",
};

const projectColorHints: Array<{ pattern: RegExp; color: string }> = [
  { pattern: /full stack|coding|development|firebase|react|typescript/i, color: "#2563EB" },
  { pattern: /german|language|b2/i, color: "#10B981" },
  { pattern: /uopeople|university|college|study/i, color: "#8B5CF6" },
  { pattern: /seo|client|work/i, color: "#F97316" },
  { pattern: /health|discipline|fitness|workout/i, color: "#EF4444" },
  { pattern: /business|money|ideas|growth/i, color: "#F59E0B" },
  { pattern: /uncategorized|other/i, color: "#64748B" },
];

export const reportTypeOptions: Array<{ value: ReportingFilters["reportType"]; label: string }> = [
  { value: "focus-minutes", label: "Focus minutes" },
  { value: "completed-tasks", label: "Completed tasks" },
  { value: "planned-vs-completed", label: "Planned vs completed" },
  { value: "priority-completion", label: "Priority completion" },
  { value: "project-comparison", label: "Project comparison" },
  { value: "area-comparison", label: "Area comparison" },
  { value: "tag-performance", label: "Tag performance" },
];

export const reportingRangeOptions: Array<{ value: ReportingFilters["range"]; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7-days", label: "7 days" },
  { value: "30-days", label: "30 days" },
  { value: "this-month", label: "This month" },
  { value: "this-year", label: "This year" },
  { value: "all-time", label: "All time" },
  { value: "custom", label: "Custom" },
];

export const reportingViewModeOptions: Array<{ value: ReportingFilters["viewMode"]; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

type ReportingRangeInfo = {
  startDate: string;
  endDate: string;
  label: string;
};

type ReportingContext = {
  tasks: Task[];
  projects: Project[];
  focusSessions: FocusSession[];
  dailyPlans: DailyPlan[];
  filters: ReportingFilters;
  todayDateId: string;
};

type ProjectTotals = {
  projectId: string;
  name: string;
  area: ProjectArea | "Uncategorized";
  emoji: string | null;
  completedTasks: number;
  focusMinutes: number;
  openTasks: number;
  overdueTasks: number;
  highUrgentCompleted: number;
  lastActivity: string;
  status: PerformanceStatus;
  recommendation: string;
};

export function getDefaultReportingFilters(): ReportingFilters {
  return {
    range: "30-days",
    viewMode: "weekly",
    reportType: "focus-minutes",
    projectId: "all",
    area: "all",
    tag: "all",
    priority: "all",
    taskStatus: "all",
    focusMode: "all",
    includeDemoData: true,
    customStart: "",
    customEnd: "",
  };
}

export function getDateRange(filters: ReportingFilters, todayDateId: string, tasks: Task[], sessions: FocusSession[], dailyPlans: DailyPlan[]): ReportingRangeInfo {
  const today = parseDateId(todayDateId);
  let startDate = todayDateId;
  let endDate = todayDateId;
  let label = "Today";

  if (filters.range === "7-days") {
    startDate = toDateId(addDays(today, -6));
    label = "Last 7 days";
  } else if (filters.range === "30-days") {
    startDate = toDateId(addDays(today, -29));
    label = "Last 30 days";
  } else if (filters.range === "this-month") {
    startDate = toDateId(new Date(today.getFullYear(), today.getMonth(), 1));
    label = "This month";
  } else if (filters.range === "this-year") {
    startDate = toDateId(new Date(today.getFullYear(), 0, 1));
    label = "This year";
  } else if (filters.range === "all-time") {
    startDate = getEarliestKnownDateId(tasks, sessions, dailyPlans, todayDateId);
    label = "All time";
  } else if (filters.range === "custom") {
    startDate = isDateId(filters.customStart) ? filters.customStart : toDateId(addDays(today, -29));
    endDate = isDateId(filters.customEnd) ? filters.customEnd : todayDateId;
    label = "Custom range";
  }

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  return { startDate, endDate, label };
}

export function buildReportingBuckets(filters: ReportingFilters, todayDateId: string, tasks: Task[], sessions: FocusSession[], dailyPlans: DailyPlan[]): ReportingBucket[] {
  const range = getDateRange(filters, todayDateId, tasks, sessions, dailyPlans);
  if (filters.viewMode === "yearly") {
    return buildYearBuckets(range);
  }
  if (filters.viewMode === "monthly") {
    return buildMonthBuckets(range);
  }
  if (filters.viewMode === "weekly") {
    return buildWeekBuckets(range);
  }
  return buildDayBuckets(range);
}

export function buildReportingDataset(context: ReportingContext): ReportingDataset {
  const filteredContext = getFilteredContext(context);

  switch (context.filters.reportType) {
    case "completed-tasks":
      return buildCompletedTasksReport(filteredContext);
    case "planned-vs-completed":
      return buildPlannedVsCompletedReport(filteredContext);
    case "priority-completion":
      return buildPriorityCompletionReport(filteredContext);
    case "project-comparison":
      return buildProjectComparisonReport(filteredContext);
    case "area-comparison":
      return buildAreaComparisonReport(filteredContext);
    case "tag-performance":
      return buildTagPerformanceReport(filteredContext);
    case "focus-minutes":
    default:
      return buildFocusMinutesReport(filteredContext);
  }
}

export function calculateFocusMinutes(session: FocusSession) {
  return getCompletedFocusMinutes(session);
}

export function calculateProjectStatus(total: Omit<ProjectTotals, "status" | "recommendation">): { status: PerformanceStatus; recommendation: string } {
  if (total.overdueTasks > 0 && total.focusMinutes === 0 && total.completedTasks === 0) {
    return {
      status: "Stuck",
      recommendation: `${total.name} has ${total.overdueTasks} overdue task${total.overdueTasks === 1 ? "" : "s"} and no progress in this range.`,
    };
  }

  if (total.completedTasks === 0 && total.focusMinutes === 0) {
    return {
      status: "Neglected",
      recommendation: `${total.name} has no completed tasks or focus minutes here. Pick one small next action.`,
    };
  }

  if (total.focusMinutes >= 90 || (total.completedTasks >= 4 && total.overdueTasks === 0)) {
    return {
      status: "Strong",
      recommendation: `${total.name} is strong: ${formatMinutes(total.focusMinutes)} and ${total.completedTasks} completed task${total.completedTasks === 1 ? "" : "s"}.`,
    };
  }

  if (total.focusMinutes > 0 || total.completedTasks > 0) {
    return {
      status: total.overdueTasks > 0 ? "Needs attention" : "Healthy",
      recommendation:
        total.overdueTasks > 0
          ? `${total.name} is moving, but ${total.overdueTasks} overdue task${total.overdueTasks === 1 ? "" : "s"} need cleanup.`
          : `${total.name} has visible progress and low overdue pressure.`,
    };
  }

  return {
    status: "Needs attention",
    recommendation: `${total.name} has open work but little recent output. Schedule one 25-minute block.`,
  };
}

export function generateReportExplanation(dataset: ReportingDataset) {
  return dataset.explanation;
}

export function generateReportingRecommendations(dataset: ReportingDataset) {
  return dataset.recommendations;
}

function buildFocusMinutesReport(context: ReportingContext): ReportingDataset {
  const { tasks, projects, focusSessions, filters, todayDateId, dailyPlans } = context;
  const range = getDateRange(filters, todayDateId, tasks, focusSessions, dailyPlans);
  const buckets = buildReportingBuckets(filters, todayDateId, tasks, focusSessions, dailyPlans);
  const projectMap = buildProjectMap(projects);
  const series = getProjectSeries(projects, focusSessions, tasks);
  const completedSessions = focusSessions.filter((session) => session.status === "completed" && isWithinRange(session.dailyPlanDate, range));
  const countedSessions = completedSessions.filter((session) => calculateFocusMinutes(session) > 0);
  const allSessionsInRange = focusSessions.filter((session) => isWithinRange(session.dailyPlanDate, range));

  const chartData = buckets.map((bucket) => {
    const row: ReportingTableRow = { label: bucket.label };
    let total = 0;
    let sessions = 0;
    series.forEach((item) => {
      const minutes = completedSessions
        .filter((session) => getProjectSeriesKey(resolveFocusSessionProjectId(session, tasks) ?? "uncategorized") === item.key)
        .filter((session) => session.dailyPlanDate >= bucket.startDate && session.dailyPlanDate <= bucket.endDate)
        .reduce((sum, session) => sum + calculateFocusMinutes(session), 0);
      row[item.key] = minutes;
      total += minutes;
      if (minutes > 0) {
        sessions += 1;
      }
    });
    row.total = total;
    row.sessions = sessions;
    return row;
  });

  const totalsByProject = sumSeries(chartData, series);
  const topSeries = totalsByProject[0] ?? null;
  const topProjectLabel = topSeries?.value ? topSeries.label : "No completed focus data";
  const totalFocus = countedSessions.reduce((sum, session) => sum + calculateFocusMinutes(session), 0);
  const averageFocus = countedSessions.length > 0 ? Math.round(totalFocus / countedSessions.length) : 0;

  const rows = buckets
    .map((bucket) => {
      const bucketSessions = completedSessions.filter((session) => session.dailyPlanDate >= bucket.startDate && session.dailyPlanDate <= bucket.endDate);
      const focusMinutes = bucketSessions.reduce((sum, session) => sum + calculateFocusMinutes(session), 0);
      const topProject = getTopProjectForSessions(bucketSessions, tasks, projectMap);
      return {
        bucket: bucket.label,
        focusMinutes,
        topProject,
        sessions: bucketSessions.filter((session) => calculateFocusMinutes(session) > 0).length,
      };
    })
    .filter((row) => row.focusMinutes > 0 || row.sessions > 0);

  const bucketSummary = summarizeBestBucket(chartData, series, "focus minutes");
  const oneBucketNote = getLowDataNote(chartData, series);
  const diagnostic =
    allSessionsInRange.length > 0 && countedSessions.length === 0
      ? `${allSessionsInRange.length} focus session${allSessionsInRange.length === 1 ? "" : "s"} exist here, but none are completed with counted minutes. Complete a timer to generate focus analytics.`
      : topSeries?.value
        ? `${bucketSummary} ${oneBucketNote}`
        : "No completed focus sessions in this range. Start and complete a focus session to populate this chart.";

  return {
    title: "Focus minutes",
    subtitle: `${range.label} grouped ${filters.viewMode}`,
    chartData,
    series,
    metrics: [
      { label: "Completed focus minutes", value: formatMinutes(totalFocus), detail: `${countedSessions.length} completed session${countedSessions.length === 1 ? "" : "s"}` },
      { label: "Average focus", value: formatMinutes(averageFocus), detail: "per completed session" },
      { label: "Top focus project", value: topProjectLabel, detail: topSeries?.value ? formatMinutes(topSeries.value) : "No completed focus data" },
      { label: "Sessions", value: `${allSessionsInRange.length}`, detail: `${countedSessions.length} completed, ${allSessionsInRange.length - countedSessions.length} incomplete` },
    ],
    columns: [
      { key: "bucket", label: "Date bucket" },
      { key: "focusMinutes", label: "Focus minutes" },
      { key: "topProject", label: "Top project" },
      { key: "sessions", label: "Completed sessions" },
    ],
    rows,
    explanation: {
      title: "What this means",
      message: diagnostic,
    },
    recommendations: buildFocusRecommendations(totalsByProject, allSessionsInRange.length, countedSessions.length),
    emptyTitle: "No completed focus sessions",
    emptyMessage: "Start and complete a focus session to populate this report.",
    summary: diagnostic.trim(),
  };
}

function buildCompletedTasksReport(context: ReportingContext): ReportingDataset {
  const { tasks, projects, focusSessions, filters, todayDateId, dailyPlans } = context;
  const range = getDateRange(filters, todayDateId, tasks, focusSessions, dailyPlans);
  const buckets = buildReportingBuckets(filters, todayDateId, tasks, focusSessions, dailyPlans);
  const series = getProjectSeries(projects, [], tasks);
  const completedTasks = tasks.filter((task) => task.status === "done" && isWithinRange(getCompletedDateId(task), range));

  const chartData = buckets.map((bucket) => {
    const row: ReportingTableRow = { label: bucket.label };
    let total = 0;
    series.forEach((item) => {
      const count = completedTasks.filter((task) => getProjectSeriesKey(task.projectId ?? "uncategorized") === item.key && isWithinBucket(getCompletedDateId(task), bucket)).length;
      row[item.key] = count;
      total += count;
    });
    row.total = total;
    return row;
  });

  const rows = buckets
    .map((bucket) => {
      const bucketTasks = completedTasks.filter((task) => isWithinBucket(getCompletedDateId(task), bucket));
      const topProject = getTopProjectForTasks(bucketTasks, projects);
      return {
        bucket: bucket.label,
        completedTasks: bucketTasks.length,
        topProject,
        highUrgentCompleted: bucketTasks.filter((task) => task.priority === "urgent" || task.priority === "high").length,
      };
    })
    .filter((row) => row.completedTasks > 0);

  const bestBucket = [...rows].sort((a, b) => Number(b.completedTasks) - Number(a.completedTasks))[0];
  const average = buckets.length > 0 ? Math.round((completedTasks.length / buckets.length) * 10) / 10 : 0;
  const bucketSummary = summarizeBestBucket(chartData, series, "completed tasks");
  const message = bestBucket
    ? `${bucketSummary} ${getLowDataNote(chartData, series)}`
    : "No completed tasks in this range. Complete a task to generate this report.";

  return {
    title: "Completed tasks",
    subtitle: `${range.label} grouped ${filters.viewMode}`,
    chartData,
    series,
    metrics: [
      { label: "Completed tasks", value: String(completedTasks.length), detail: "done in selected range" },
      { label: "Average", value: `${average}`, detail: "tasks per bucket" },
      { label: "Best bucket", value: bestBucket?.bucket ?? "None", detail: bestBucket ? `${bestBucket.completedTasks} tasks` : "No completion data" },
      { label: "High/urgent done", value: String(completedTasks.filter((task) => task.priority === "urgent" || task.priority === "high").length), detail: "important completions" },
    ],
    columns: [
      { key: "bucket", label: "Date bucket" },
      { key: "completedTasks", label: "Completed tasks" },
      { key: "topProject", label: "Top project" },
      { key: "highUrgentCompleted", label: "High/urgent done" },
    ],
    rows,
    explanation: { title: "What this means", message },
    recommendations: buildTaskRecommendations(tasks, projects, completedTasks),
    emptyTitle: "No completed tasks",
    emptyMessage: "Complete tasks in this range to see completion patterns.",
    summary: message,
  };
}

function buildPlannedVsCompletedReport(context: ReportingContext): ReportingDataset {
  const { tasks, projects, focusSessions, dailyPlans, filters, todayDateId } = context;
  const range = getDateRange(filters, todayDateId, tasks, focusSessions, dailyPlans);
  const buckets = buildReportingBuckets(filters, todayDateId, tasks, focusSessions, dailyPlans);

  const chartData = buckets.map((bucket) => {
    const plans = dailyPlans.filter((plan) => plan.date >= bucket.startDate && plan.date <= bucket.endDate);
    const planned = unique(plans.flatMap((plan) => plan.topTaskIds)).length;
    const completed = tasks.filter((task) => task.status === "done" && isWithinBucket(getCompletedDateId(task), bucket)).length;
    const topThreeDone = plans.reduce((sum, plan) => sum + plan.topTaskIds.filter((taskId) => tasks.find((task) => task.id === taskId && task.status === "done")).length, 0);
    const timeBlocksDone = plans.reduce((sum, plan) => sum + plan.timeBlocks.filter((block) => block.completed).length, 0);
    return {
      label: bucket.label,
      planned,
      completed,
      topThreeDone,
      timeBlocksDone,
      percentage: planned > 0 ? Math.round((completed / planned) * 100) : completed > 0 ? 100 : 0,
      truePercentage: planned > 0 ? Math.round((completed / planned) * 100) : 0,
    };
  });

  const rows = chartData.filter((row) => Number(row.planned) > 0 || Number(row.completed) > 0 || Number(row.timeBlocksDone) > 0).map((row) => ({
    bucket: String(row.label),
    plannedTasks: Number(row.planned),
    completedTasks: Number(row.completed),
    topThreeDone: Number(row.topThreeDone),
    timeBlocksDone: Number(row.timeBlocksDone),
    completionPercentage: `${Number(row.truePercentage)}%`,
  }));

  const totalPlanned = chartData.reduce((sum, row) => sum + Number(row.planned), 0);
  const totalCompleted = chartData.reduce((sum, row) => sum + Number(row.completed), 0);
  const truePercentage = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0;
  const message =
    totalPlanned === 0
      ? "No daily plan history exists for this range. Use Today planning for a few days."
      : totalCompleted > totalPlanned
        ? `You completed more than planned: ${totalCompleted} completed vs ${totalPlanned} planned. This may mean flexible capture is working, or planning targets are low.`
        : `You completed ${totalCompleted} of ${totalPlanned} planned tasks in this range.`;

  return {
    title: "Planned vs completed",
    subtitle: `${range.label} grouped ${filters.viewMode}`,
    chartData,
    series: [
      { key: "planned", label: "Planned tasks", color: metricColors.planned },
      { key: "completed", label: "Completed tasks", color: metricColors.completed },
      { key: "topThreeDone", label: "Top 3 done", color: metricColors.topThree },
      { key: "timeBlocksDone", label: "Time blocks done", color: metricColors.timeBlocks },
    ],
    metrics: [
      { label: "Planned tasks", value: String(totalPlanned), detail: "from daily plans" },
      { label: "Completed tasks", value: String(totalCompleted), detail: "actual completions" },
      { label: "Completion rate", value: `${truePercentage}%`, detail: totalCompleted > totalPlanned ? "visual chart caps at 100%" : "planned task completion" },
      { label: "Time blocks done", value: String(chartData.reduce((sum, row) => sum + Number(row.timeBlocksDone), 0)), detail: "completed blocks" },
    ],
    columns: [
      { key: "bucket", label: "Date bucket" },
      { key: "plannedTasks", label: "Planned tasks" },
      { key: "completedTasks", label: "Completed tasks" },
      { key: "topThreeDone", label: "Top 3 done" },
      { key: "timeBlocksDone", label: "Time blocks done" },
      { key: "completionPercentage", label: "Completion %" },
    ],
    rows,
    explanation: { title: "What this means", message },
    recommendations: buildPlanningRecommendations(totalPlanned, totalCompleted),
    emptyTitle: "No planning history",
    emptyMessage: "Use Today planning and Top 3 priorities to populate this report.",
    summary: message,
  };
}

function buildPriorityCompletionReport(context: ReportingContext): ReportingDataset {
  const { tasks, focusSessions, dailyPlans, filters, todayDateId } = context;
  const range = getDateRange(filters, todayDateId, tasks, focusSessions, dailyPlans);
  const rows = priorities.map((priority) => {
    const completed = tasks.filter((task) => task.priority === priority && task.status === "done" && isWithinRange(getCompletedDateId(task), range)).length;
    const open = tasks.filter((task) => task.priority === priority && task.status !== "done" && task.status !== "archived").length;
    const overdue = tasks.filter((task) => task.priority === priority && isTaskOverdue(task, todayDateId)).length;
    const total = completed + open;
    return {
      priority,
      completed,
      open,
      overdue,
      percentageComplete: total > 0 ? `${Math.round((completed / total) * 100)}%` : "0%",
      recommendation: getPriorityRecommendation(priority, completed, open, overdue),
    };
  });

  const lowMediumCompleted = rows.filter((row) => row.priority === "low" || row.priority === "medium").reduce((sum, row) => sum + Number(row.completed), 0);
  const urgentHighOpen = rows.filter((row) => row.priority === "urgent" || row.priority === "high").reduce((sum, row) => sum + Number(row.open), 0);
  const warning =
    lowMediumCompleted > 0 && urgentHighOpen > 0
      ? `You completed ${lowMediumCompleted} low/medium task${lowMediumCompleted === 1 ? "" : "s"} while ${urgentHighOpen} urgent/high task${urgentHighOpen === 1 ? "" : "s"} remain open.`
      : "Priority completion is balanced for the current data.";

  return {
    title: "Priority completion",
    subtitle: `${range.label} by priority`,
    chartData: rows.map((row) => ({ label: String(row.priority), priority: String(row.priority), completed: Number(row.completed), open: Number(row.open), overdue: Number(row.overdue) })),
    series: [
      { key: "completed", label: "Completed", color: metricColors.completed },
      { key: "open", label: "Open", color: metricColors.open },
      { key: "overdue", label: "Overdue", color: metricColors.overdue },
    ],
    metrics: [
      { label: "Urgent/high open", value: String(urgentHighOpen), detail: "important tasks still open" },
      { label: "Low/medium done", value: String(lowMediumCompleted), detail: "lower priority completions" },
      { label: "Overdue urgent/high", value: String(rows.filter((row) => row.priority === "urgent" || row.priority === "high").reduce((sum, row) => sum + Number(row.overdue), 0)), detail: "needs cleanup" },
      { label: "Signal", value: urgentHighOpen > 0 ? "Watch" : "Clear", detail: warning },
    ],
    columns: [
      { key: "priority", label: "Priority" },
      { key: "completed", label: "Completed" },
      { key: "open", label: "Open" },
      { key: "overdue", label: "Overdue" },
      { key: "percentageComplete", label: "Complete" },
      { key: "recommendation", label: "Recommendation" },
    ],
    rows,
    explanation: { title: "What this means", message: warning },
    recommendations: [
      urgentHighOpen > 0
        ? {
            id: "urgent-open",
            title: "Pick important work first",
            message: `There are ${urgentHighOpen} urgent/high tasks open. Move one into Today or Top 3.`,
            severity: "warning",
            action: "Choose one urgent/high task.",
          }
        : {
            id: "urgent-clear",
            title: "Important work is under control",
            message: "No urgent/high backlog is visible in this report.",
            severity: "success",
            action: "Keep reviewing priority before adding new work.",
          },
    ],
    emptyTitle: "No priority data",
    emptyMessage: "Create tasks with priorities to populate this report.",
    summary: warning,
  };
}

function buildProjectComparisonReport(context: ReportingContext): ReportingDataset {
  const totals = getProjectTotals(context);
  const rows = totals.map((project) => ({
    project: formatEntityName(project.emoji, project.name),
    area: project.area,
    completedTasks: project.completedTasks,
    focusMinutes: project.focusMinutes,
    openTasks: project.openTasks,
    overdueTasks: project.overdueTasks,
    lastActivity: project.lastActivity || "No activity",
    status: project.status,
    recommendation: project.recommendation,
  }));

  const best = totals.find((project) => project.status === "Strong") ?? [...totals].sort((a, b) => b.focusMinutes + b.completedTasks * 25 - (a.focusMinutes + a.completedTasks * 25))[0];
  const attention = totals.find((project) => project.status === "Stuck") ?? totals.find((project) => project.status === "Neglected") ?? totals.find((project) => project.status === "Needs attention");
  const message = best
    ? `${best.name} is the strongest project here with ${formatMinutes(best.focusMinutes)} and ${best.completedTasks} completed task${best.completedTasks === 1 ? "" : "s"}.`
    : "No project-linked data yet. Assign tasks to projects for better reporting.";

  return {
    title: "Project comparison",
    subtitle: "Completed tasks, focus minutes, open load, and overdue pressure",
    chartData: rows,
    series: [
      { key: "completedTasks", label: "Completed tasks", color: metricColors.completed },
      { key: "focusMinutes", label: "Focus minutes", color: metricColors.focus },
      { key: "openTasks", label: "Open tasks", color: metricColors.open },
      { key: "overdueTasks", label: "Overdue tasks", color: metricColors.overdue },
    ],
    metrics: [
      { label: "Best project", value: best ? formatEntityName(best.emoji, best.name) : "None", detail: best ? best.recommendation : "No project data" },
      { label: "Needs attention", value: attention ? formatEntityName(attention.emoji, attention.name) : "None", detail: attention?.recommendation ?? "No weak project signal" },
      { label: "Projects compared", value: String(totals.length), detail: "including Uncategorized if needed" },
      { label: "Overdue load", value: String(totals.reduce((sum, project) => sum + project.overdueTasks, 0)), detail: "open overdue tasks" },
    ],
    columns: getProjectAreaColumns("project"),
    rows,
    explanation: { title: "What this means", message },
    recommendations: buildProjectRecommendations(totals),
    emptyTitle: "No project data",
    emptyMessage: "Create or assign tasks to projects to compare project performance.",
    summary: message,
  };
}

function buildAreaComparisonReport(context: ReportingContext): ReportingDataset {
  const projectTotals = getProjectTotals(context);
  const areaTotals = areaOrder
    .map((area) => {
      const areaProjects = projectTotals.filter((project) => project.area === area);
      const base: Omit<ProjectTotals, "status" | "recommendation"> = {
        projectId: area,
        name: area,
        area,
        emoji: getAreaEmoji(area),
        completedTasks: areaProjects.reduce((sum, project) => sum + project.completedTasks, 0),
        focusMinutes: areaProjects.reduce((sum, project) => sum + project.focusMinutes, 0),
        openTasks: areaProjects.reduce((sum, project) => sum + project.openTasks, 0),
        overdueTasks: areaProjects.reduce((sum, project) => sum + project.overdueTasks, 0),
        highUrgentCompleted: areaProjects.reduce((sum, project) => sum + project.highUrgentCompleted, 0),
        lastActivity: areaProjects.map((project) => project.lastActivity).filter(Boolean).sort().reverse()[0] ?? "",
      };
      const result = calculateProjectStatus(base);
      return { ...base, ...result };
    })
    .filter((area) => area.completedTasks > 0 || area.focusMinutes > 0 || area.openTasks > 0 || area.overdueTasks > 0);

  const rows = areaTotals.map((area) => ({
    area: formatEntityName(area.emoji, area.name),
    completedTasks: area.completedTasks,
    focusMinutes: area.focusMinutes,
    openTasks: area.openTasks,
    overdueTasks: area.overdueTasks,
    lastActivity: area.lastActivity || "No activity",
    status: area.status,
    recommendation: area.recommendation,
  }));
  const best = areaTotals.find((area) => area.status === "Strong") ?? [...areaTotals].sort((a, b) => b.focusMinutes + b.completedTasks * 25 - (a.focusMinutes + a.completedTasks * 25))[0];
  const attention = areaTotals.find((area) => area.status === "Stuck") ?? areaTotals.find((area) => area.status === "Neglected") ?? areaTotals.find((area) => area.status === "Needs attention");
  const message = best
    ? `${best.name} is the strongest area in this range with ${formatMinutes(best.focusMinutes)} and ${best.completedTasks} completed task${best.completedTasks === 1 ? "" : "s"}.`
    : "No area data yet. Assign tasks to projects or tags to make area reporting useful.";

  return {
    title: "Area comparison",
    subtitle: "Study, business, health, client work, personal, and uncategorized activity",
    chartData: rows,
    series: [
      { key: "completedTasks", label: "Completed tasks", color: metricColors.completed },
      { key: "focusMinutes", label: "Focus minutes", color: metricColors.focus },
      { key: "openTasks", label: "Open tasks", color: metricColors.open },
      { key: "overdueTasks", label: "Overdue tasks", color: metricColors.overdue },
    ],
    metrics: [
      { label: "Best area", value: best ? formatEntityName(best.emoji, best.name) : "None", detail: best?.recommendation ?? "No area data" },
      { label: "Needs attention", value: attention ? formatEntityName(attention.emoji, attention.name) : "None", detail: attention?.recommendation ?? "No weak area signal" },
      { label: "Areas compared", value: String(areaTotals.length), detail: "areas with visible data" },
      { label: "Overdue load", value: String(areaTotals.reduce((sum, area) => sum + area.overdueTasks, 0)), detail: "open overdue tasks" },
    ],
    columns: getProjectAreaColumns("area"),
    rows,
    explanation: { title: "What this means", message },
    recommendations: buildProjectRecommendations(areaTotals),
    emptyTitle: "No area data",
    emptyMessage: "Assign tasks to projects with areas to compare life areas.",
    summary: message,
  };
}

function buildTagPerformanceReport(context: ReportingContext): ReportingDataset {
  const { tasks, focusSessions, filters, todayDateId, projects, dailyPlans } = context;
  const range = getDateRange(filters, todayDateId, tasks, focusSessions, dailyPlans);
  const tags = unique(tasks.flatMap((task) => task.tags)).sort();
  const rows = tags
    .map((tag) => {
      const taggedTasks = tasks.filter((task) => task.tags.includes(tag));
      const completedTasks = taggedTasks.filter((task) => task.status === "done" && isWithinRange(getCompletedDateId(task), range)).length;
      const openTasks = taggedTasks.filter((task) => task.status !== "done" && task.status !== "archived").length;
      const overdueTasks = taggedTasks.filter((task) => isTaskOverdue(task, todayDateId)).length;
      const taskIds = new Set(taggedTasks.map((task) => task.id));
      const focusMinutes = focusSessions
        .filter((session) => session.taskId && taskIds.has(session.taskId) && isWithinRange(session.dailyPlanDate, range))
        .reduce((sum, session) => sum + calculateFocusMinutes(session), 0);
      return {
        tag: `#${tag}`,
        completedTasks,
        openTasks,
        overdueTasks,
        focusMinutes,
      };
    })
    .filter((row) => row.completedTasks > 0 || row.openTasks > 0 || row.overdueTasks > 0 || row.focusMinutes > 0)
    .sort((a, b) => Number(b.openTasks) + Number(b.completedTasks) - (Number(a.openTasks) + Number(a.completedTasks)));

  const strongest = [...rows].sort((a, b) => Number(b.completedTasks) + Number(b.focusMinutes) / 25 - (Number(a.completedTasks) + Number(a.focusMinutes) / 25))[0];
  const collectingWork = [...rows].sort((a, b) => Number(b.openTasks) + Number(b.overdueTasks) * 2 - (Number(a.openTasks) + Number(a.overdueTasks) * 2))[0];
  const message = strongest
    ? `${strongest.tag} is the most active tag here with ${strongest.completedTasks} completed task${strongest.completedTasks === 1 ? "" : "s"} and ${formatMinutes(Number(strongest.focusMinutes))}.`
    : "No tag data found. Add tags to tasks for tag reporting.";

  return {
    title: "Tag performance",
    subtitle: `${range.label} by task tags`,
    chartData: rows,
    series: [
      { key: "completedTasks", label: "Completed tasks", color: metricColors.completed },
      { key: "openTasks", label: "Open tasks", color: metricColors.open },
      { key: "overdueTasks", label: "Overdue tasks", color: metricColors.overdue },
      { key: "focusMinutes", label: "Focus minutes", color: metricColors.focus },
    ],
    metrics: [
      { label: "Active tag", value: strongest?.tag ?? "None", detail: strongest ? `${strongest.completedTasks} completed, ${formatMinutes(Number(strongest.focusMinutes))}` : "No tag activity" },
      { label: "Collecting work", value: collectingWork?.tag ?? "None", detail: collectingWork ? `${collectingWork.openTasks} open, ${collectingWork.overdueTasks} overdue` : "No tag backlog" },
      { label: "Tags compared", value: String(rows.length), detail: "tags with visible work" },
      { label: "Tagged focus", value: formatMinutes(rows.reduce((sum, row) => sum + Number(row.focusMinutes), 0)), detail: "linked through tasks" },
    ],
    columns: [
      { key: "tag", label: "Tag" },
      { key: "completedTasks", label: "Completed" },
      { key: "openTasks", label: "Open" },
      { key: "overdueTasks", label: "Overdue" },
      { key: "focusMinutes", label: "Focus minutes" },
    ],
    rows,
    explanation: { title: "What this means", message },
    recommendations: buildTagRecommendations(rows),
    emptyTitle: "No tag data",
    emptyMessage: "Add tags like #german, #coding, or #health to tasks to populate this report.",
    summary: message,
  };
}

function getFilteredContext(context: ReportingContext): ReportingContext {
  const { filters, projects, todayDateId } = context;
  const projectMap = buildProjectMap(projects);
  const tasks = context.tasks.filter((task) => {
    if (!filters.includeDemoData && task.isDemoData) {
      return false;
    }
    if (filters.projectId === "uncategorized" && task.projectId) {
      return false;
    }
    if (filters.projectId !== "all" && filters.projectId !== "uncategorized" && task.projectId !== filters.projectId) {
      return false;
    }
    if (filters.area !== "all") {
      const area = task.projectId ? projectMap.get(task.projectId)?.area ?? "Uncategorized" : "Uncategorized";
      if (area !== filters.area) {
        return false;
      }
    }
    if (filters.tag !== "all" && !task.tags.includes(filters.tag)) {
      return false;
    }
    if (filters.priority !== "all" && task.priority !== filters.priority) {
      return false;
    }
    if (filters.taskStatus !== "all" && !matchesTaskStatus(task, filters.taskStatus, todayDateId)) {
      return false;
    }
    return true;
  });
  const allowedTaskIds = new Set(tasks.map((task) => task.id));
  const focusSessions = context.focusSessions.filter((session) => {
    if (!filters.includeDemoData && session.isDemoData) {
      return false;
    }
    if (filters.focusMode !== "all" && session.mode !== filters.focusMode) {
      return false;
    }
    if (session.taskId && !allowedTaskIds.has(session.taskId)) {
      return false;
    }
    const projectId = resolveFocusSessionProjectId(session, tasks);
    if (filters.projectId === "uncategorized" && projectId) {
      return false;
    }
    if (filters.projectId !== "all" && filters.projectId !== "uncategorized" && projectId !== filters.projectId) {
      return false;
    }
    if (filters.area !== "all") {
      const area = projectId ? projectMap.get(projectId)?.area ?? "Uncategorized" : "Uncategorized";
      if (area !== filters.area) {
        return false;
      }
    }
    return true;
  });
  const dailyPlans = context.dailyPlans.filter((plan) => filters.includeDemoData || !plan.isDemoData);
  const filteredProjects = projects.filter((project) => filters.includeDemoData || !project.isDemoData);

  return {
    ...context,
    tasks,
    projects: filteredProjects,
    focusSessions,
    dailyPlans,
  };
}

function getProjectTotals(context: ReportingContext): ProjectTotals[] {
  const { tasks, projects, focusSessions, dailyPlans, filters, todayDateId } = context;
  const range = getDateRange(filters, todayDateId, tasks, focusSessions, dailyPlans);
  const projectMap = buildProjectMap(projects);
  const ids = new Set<string>(projects.map((project) => project.id));
  tasks.forEach((task) => ids.add(task.projectId ?? "uncategorized"));
  focusSessions.forEach((session) => ids.add(resolveFocusSessionProjectId(session, tasks) ?? "uncategorized"));

  return [...ids]
    .map((projectId) => {
      const project = projectMap.get(projectId);
      const projectTasks = tasks.filter((task) => (task.projectId ?? "uncategorized") === projectId);
      const projectSessions = focusSessions.filter((session) => (resolveFocusSessionProjectId(session, tasks) ?? "uncategorized") === projectId && isWithinRange(session.dailyPlanDate, range));
      const completedTasks = projectTasks.filter((task) => task.status === "done" && isWithinRange(getCompletedDateId(task), range)).length;
      const focusMinutes = projectSessions.reduce((sum, session) => sum + calculateFocusMinutes(session), 0);
      const openTasks = projectTasks.filter((task) => task.status !== "done" && task.status !== "archived").length;
      const overdueTasks = projectTasks.filter((task) => isTaskOverdue(task, todayDateId)).length;
      const highUrgentCompleted = projectTasks.filter((task) => task.status === "done" && (task.priority === "urgent" || task.priority === "high") && isWithinRange(getCompletedDateId(task), range)).length;
      const lastActivity = getLatestActivityDate(projectTasks, projectSessions);
      const base: Omit<ProjectTotals, "status" | "recommendation"> = {
        projectId,
        name: project?.name ?? "Uncategorized",
        area: (project?.area ?? "Uncategorized") as ProjectArea | "Uncategorized",
        emoji: project?.emoji ?? null,
        completedTasks,
        focusMinutes,
        openTasks,
        overdueTasks,
        highUrgentCompleted,
        lastActivity,
      };
      return { ...base, ...calculateProjectStatus(base) };
    })
    .filter((project) => project.completedTasks > 0 || project.focusMinutes > 0 || project.openTasks > 0 || project.overdueTasks > 0)
    .sort((a, b) => b.focusMinutes + b.completedTasks * 25 + b.openTasks * 3 - (a.focusMinutes + a.completedTasks * 25 + a.openTasks * 3));
}

function buildProjectMap(projects: Project[]) {
  return new Map(projects.map((project) => [project.id, project]));
}

function getProjectSeries(projects: Project[], focusSessions: FocusSession[], tasks: Task[]): ReportingSeries[] {
  const projectMap = buildProjectMap(projects);
  const ids = new Set<string>(projects.map((project) => project.id));
  tasks.forEach((task) => ids.add(task.projectId ?? "uncategorized"));
  focusSessions.forEach((session) => ids.add(resolveFocusSessionProjectId(session, tasks) ?? "uncategorized"));

  return [...ids]
    .map((projectId, index) => {
      const project = projectMap.get(projectId);
      const label = project?.name ?? "Uncategorized";
      return {
        key: getProjectSeriesKey(projectId),
        label: formatEntityName(project?.emoji ?? null, label),
        color: getReportingColor(label, index),
      };
    })
    .slice(0, 10);
}

function sumSeries(chartData: ReportingTableRow[], series: ReportingSeries[]) {
  return series
    .map((item) => ({
      ...item,
      value: chartData.reduce((sum, row) => sum + Number(row[item.key] ?? 0), 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function summarizeBestBucket(chartData: ReportingTableRow[], series: ReportingSeries[], unitLabel: string) {
  const bestRow = [...chartData]
    .map((row) => ({
      row,
      total: series.reduce((sum, item) => sum + Number(row[item.key] ?? 0), 0),
    }))
    .sort((a, b) => b.total - a.total)[0];

  if (!bestRow || bestRow.total <= 0) {
    return "No chart activity is visible in this range.";
  }

  const parts = series
    .map((item) => ({ label: item.label, value: Number(bestRow.row[item.key] ?? 0) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
    .map((item) => `${item.label} ${item.value}`);

  return `${bestRow.row.label} had ${bestRow.total} ${unitLabel}${parts.length > 0 ? `: ${parts.join(", ")}.` : "."}`;
}

function getLowDataNote(chartData: ReportingTableRow[], series: ReportingSeries[]) {
  const activeBuckets = chartData.filter((row) => series.some((item) => Number(row[item.key] ?? 0) > 0)).length;
  return activeBuckets === 1 ? "Only one data bucket is available. Use a wider range, use the app for a few more days, or seed demo data to see trends." : "";
}

function getTopProjectForSessions(sessions: FocusSession[], tasks: Task[], projectMap: Map<string, Project>) {
  const totals = new Map<string, number>();
  sessions.forEach((session) => {
    const projectId = resolveFocusSessionProjectId(session, tasks) ?? "uncategorized";
    totals.set(projectId, (totals.get(projectId) ?? 0) + calculateFocusMinutes(session));
  });
  const [projectId, minutes] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!projectId || !minutes) {
    return "None";
  }
  const project = projectMap.get(projectId);
  return formatEntityName(project?.emoji ?? null, project?.name ?? "Uncategorized");
}

function getTopProjectForTasks(tasks: Task[], projects: Project[]) {
  const projectMap = buildProjectMap(projects);
  const totals = new Map<string, number>();
  tasks.forEach((task) => {
    const projectId = task.projectId ?? "uncategorized";
    totals.set(projectId, (totals.get(projectId) ?? 0) + 1);
  });
  const [projectId] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!projectId) {
    return "None";
  }
  const project = projectMap.get(projectId);
  return formatEntityName(project?.emoji ?? null, project?.name ?? "Uncategorized");
}

function getLatestActivityDate(tasks: Task[], sessions: FocusSession[]) {
  return [
    ...tasks.map((task) => getCompletedDateId(task) || getDateIdFromTimestampLike(task.updatedAt) || getDateIdFromTimestampLike(task.createdAt) || task.dueDate),
    ...sessions.map((session) => session.completedAt?.slice(0, 10) || session.dailyPlanDate),
  ]
    .filter(Boolean)
    .sort()
    .reverse()[0] ?? "";
}

function getProjectAreaColumns(firstKey: "project" | "area"): ReportingTableColumn[] {
  return [
    { key: firstKey, label: firstKey === "project" ? "Project" : "Area" },
    ...(firstKey === "project" ? [{ key: "area", label: "Area" }] : []),
    { key: "completedTasks", label: "Completed" },
    { key: "focusMinutes", label: "Focus min" },
    { key: "openTasks", label: "Open" },
    { key: "overdueTasks", label: "Overdue" },
    { key: "lastActivity", label: "Last activity" },
    { key: "status", label: "Status" },
    { key: "recommendation", label: "Recommendation" },
  ];
}

function buildFocusRecommendations(totals: Array<ReportingSeries & { value: number }>, totalSessions: number, countedSessions: number): ReportingRecommendation[] {
  if (countedSessions === 0) {
    return [
      {
        id: "focus-start",
        title: totalSessions > 0 ? "Finish a focus session" : "Start one focus block",
        message:
          totalSessions > 0
            ? `${totalSessions} focus session${totalSessions === 1 ? "" : "s"} exist, but none counted completed minutes. Complete one timer session.`
            : "No completed focus sessions exist in this range. Start with one 25-minute block.",
        severity: "warning",
        action: "Open Focus and complete a Pomodoro.",
      },
    ];
  }

  const top = totals[0];
  const low = totals.find((item) => item.value < 25);
  return [
    {
      id: "focus-top",
      title: `${top.label} is getting attention`,
      message: `${top.label} has ${formatMinutes(top.value)} of completed focus in this range.`,
      severity: "success",
      action: "Keep this project alive with one short session tomorrow.",
    },
    low
      ? {
          id: "focus-low",
          title: `${low.label} has low focus`,
          message: `${low.label} has only ${formatMinutes(low.value)}. Schedule one 25-minute block if it matters this week.`,
          severity: "warning",
          action: "Schedule a Pomodoro for the weaker project.",
        }
      : {
          id: "focus-balance",
          title: "Focus has a clear winner",
          message: "Use the chart to decide whether this attention matches your priorities.",
          severity: "info",
          action: "Compare focus with open task load.",
        },
  ];
}

function buildTaskRecommendations(tasks: Task[], projects: Project[], completedTasks: Task[]): ReportingRecommendation[] {
  const urgentOpen = tasks.filter((task) => (task.priority === "urgent" || task.priority === "high") && task.status !== "done" && task.status !== "archived").length;
  const topProject = getTopProjectForTasks(completedTasks, projects);
  return [
    completedTasks.length > 0
      ? {
          id: "task-top",
          title: `${topProject} produced completions`,
          message: `${topProject} appears most in completed tasks for this range.`,
          severity: "success",
          action: "Check whether this matches the most important project.",
        }
      : {
          id: "task-none",
          title: "No completed tasks yet",
          message: "Finish one small task to start building completion history.",
          severity: "info",
          action: "Choose one task and mark it done.",
        },
    urgentOpen > 0
      ? {
          id: "task-urgent",
          title: "Important work remains",
          message: `${urgentOpen} urgent/high task${urgentOpen === 1 ? "" : "s"} are still open.`,
          severity: "warning",
          action: "Move one urgent/high task into Today.",
        }
      : {
          id: "task-clean",
          title: "Important backlog is clear",
          message: "No urgent/high backlog is visible.",
          severity: "success",
          action: "Keep priority review tight.",
        },
  ];
}

function buildPlanningRecommendations(planned: number, completed: number): ReportingRecommendation[] {
  if (planned === 0) {
    return [
      {
        id: "planning-start",
        title: "Use Today planning",
        message: "No planned task history exists here. Choose Top 3 priorities for a few days.",
        severity: "info",
        action: "Open Today and set Top 3.",
      },
    ];
  }
  if (completed > planned) {
    return [
      {
        id: "planning-low",
        title: "Planning target may be low",
        message: `You completed ${completed} tasks against ${planned} planned. Raise the plan only if those completions are intentional.`,
        severity: "info",
        action: "Review whether extra completions are valuable.",
      },
    ];
  }
  if (completed < Math.max(1, planned / 2)) {
    return [
      {
        id: "planning-heavy",
        title: "Plan fewer tasks",
        message: `You completed ${completed} of ${planned} planned tasks. Tomorrow, choose fewer tasks and protect one focus block.`,
        severity: "warning",
        action: "Reduce tomorrow's plan.",
      },
    ];
  }
  return [
    {
      id: "planning-balanced",
      title: "Planning looks realistic",
      message: `You completed ${completed} of ${planned} planned tasks.`,
      severity: "success",
      action: "Keep planning at this level.",
    },
  ];
}

function buildProjectRecommendations(totals: Array<Pick<ProjectTotals, "projectId" | "name" | "focusMinutes" | "completedTasks" | "openTasks" | "overdueTasks" | "status" | "recommendation">>): ReportingRecommendation[] {
  const best = totals.find((item) => item.status === "Strong") ?? totals[0];
  const weak = totals.find((item) => item.status === "Stuck") ?? totals.find((item) => item.status === "Neglected") ?? totals.find((item) => item.status === "Needs attention");
  return [
    best
      ? {
          id: "best-performance",
          title: `${best.name} is performing best`,
          message: `${best.name} has ${formatMinutes(best.focusMinutes)} and ${best.completedTasks} completed task${best.completedTasks === 1 ? "" : "s"}.`,
          severity: "success",
          action: "Keep the momentum with one short follow-up.",
        }
      : {
          id: "no-project-performance",
          title: "No project signal yet",
          message: "Assign tasks to projects and complete focus sessions to see comparisons.",
          severity: "info",
          action: "Assign one task to a project.",
        },
    weak
      ? {
          id: "weak-performance",
          title: `${weak.name} needs attention`,
          message: weak.recommendation,
          severity: weak.status === "Stuck" ? "danger" : "warning",
          action: "Move one small task into Today or start a Pomodoro.",
        }
      : {
          id: "no-weak-performance",
          title: "No weak area detected",
          message: "The selected data does not show a stuck or neglected project.",
          severity: "success",
          action: "Keep checking weekly.",
        },
  ];
}

function buildTagRecommendations(rows: ReportingTableRow[]): ReportingRecommendation[] {
  const backlog = [...rows].sort((a, b) => Number(b.openTasks) + Number(b.overdueTasks) * 2 - (Number(a.openTasks) + Number(a.overdueTasks) * 2))[0];
  if (!backlog) {
    return [
      {
        id: "tag-start",
        title: "Tag important work",
        message: "No tags have enough data yet. Use #german, #coding, #seo, or #health in quick capture.",
        severity: "info",
        action: "Add tags to tasks.",
      },
    ];
  }
  return [
    {
      id: "tag-backlog",
      title: `${backlog.tag} is collecting work`,
      message: `${backlog.tag} has ${backlog.openTasks} open task${Number(backlog.openTasks) === 1 ? "" : "s"} and ${backlog.overdueTasks} overdue.`,
      severity: Number(backlog.overdueTasks) > 0 ? "warning" : "info",
      action: "Clear or schedule one tagged task.",
    },
  ];
}

function getPriorityRecommendation(priority: TaskPriority, completed: number, open: number, overdue: number) {
  if (overdue > 0) {
    return `${priority} has ${overdue} overdue task${overdue === 1 ? "" : "s"}.`;
  }
  if ((priority === "urgent" || priority === "high") && open > 0 && completed === 0) {
    return `Pick one ${priority} task for Top 3.`;
  }
  if (completed > 0) {
    return `${completed} completed in this range.`;
  }
  return "No signal yet.";
}

function matchesTaskStatus(task: Task, status: ReportingFilters["taskStatus"], todayDateId: string) {
  if (status === "open") {
    return task.status !== "done" && task.status !== "archived";
  }
  if (status === "completed") {
    return task.status === "done";
  }
  if (status === "overdue") {
    return isTaskOverdue(task, todayDateId);
  }
  return task.status === status;
}

function getCompletedDateId(task: Task) {
  return getDateIdFromTimestampLike(task.completedAt) || getDateIdFromTimestampLike(task.updatedAt) || task.dueDate || "";
}

function isTaskOverdue(task: Task, todayDateId: string) {
  return Boolean(task.dueDate && task.dueDate < todayDateId && task.status !== "done" && task.status !== "archived");
}

function getProjectSeriesKey(projectId: string) {
  return `project_${projectId.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function getAreaEmoji(area: ProjectArea | "Uncategorized") {
  switch (area) {
    case "Study":
      return "📚";
    case "Business":
      return "💰";
    case "Health":
      return "🏋️";
    case "Client Work":
      return "📈";
    case "Personal":
      return "🧭";
    case "Other":
      return "⭐";
    case "Uncategorized":
      return null;
  }
}

function getReportingColor(label: string, index: number) {
  const hint = projectColorHints.find((item) => item.pattern.test(label));
  return hint?.color ?? palette[index % palette.length];
}

function formatEntityName(emoji: string | null, name: string) {
  return emoji ? `${emoji} ${name}` : name;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function isWithinBucket(dateId: string, bucket: ReportingBucket) {
  return Boolean(dateId && dateId >= bucket.startDate && dateId <= bucket.endDate);
}

function isWithinRange(dateId: string, range: ReportingRangeInfo) {
  return Boolean(dateId && dateId >= range.startDate && dateId <= range.endDate);
}

function buildDayBuckets(range: ReportingRangeInfo): ReportingBucket[] {
  const buckets: ReportingBucket[] = [];
  const start = parseDateId(range.startDate);
  const count = diffDays(range.startDate, range.endDate);

  for (let index = 0; index <= count; index += 1) {
    const date = addDays(start, index);
    const id = toDateId(date);
    buckets.push({
      id,
      label: count <= 8 ? new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date) : formatShortDate(id),
      startDate: id,
      endDate: id,
    });
  }

  return buckets;
}

function buildWeekBuckets(range: ReportingRangeInfo): ReportingBucket[] {
  const buckets: ReportingBucket[] = [];
  let cursor = parseDateId(range.startDate);
  const end = parseDateId(range.endDate);

  while (cursor <= end) {
    const start = toDateId(cursor);
    const bucketEnd = toDateId(new Date(Math.min(addDays(cursor, 6).getTime(), end.getTime())));
    buckets.push({
      id: start,
      label: `Week ${formatShortDate(start)}`,
      startDate: start,
      endDate: bucketEnd,
    });
    cursor = addDays(cursor, 7);
  }

  return buckets;
}

function buildMonthBuckets(range: ReportingRangeInfo): ReportingBucket[] {
  const buckets: ReportingBucket[] = [];
  const start = parseDateId(range.startDate);
  const end = parseDateId(range.endDate);
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cursor <= end) {
    const bucketStartDate = new Date(Math.max(cursor.getTime(), start.getTime()));
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const bucketEndDate = new Date(Math.min(monthEnd.getTime(), end.getTime()));
    const id = toDateId(bucketStartDate);
    buckets.push({
      id,
      label: new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(cursor),
      startDate: id,
      endDate: toDateId(bucketEndDate),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return buckets;
}

function buildYearBuckets(range: ReportingRangeInfo): ReportingBucket[] {
  const buckets: ReportingBucket[] = [];
  const start = parseDateId(range.startDate);
  const end = parseDateId(range.endDate);
  let cursor = new Date(start.getFullYear(), 0, 1);

  while (cursor <= end) {
    const bucketStartDate = new Date(Math.max(cursor.getTime(), start.getTime()));
    const yearEnd = new Date(cursor.getFullYear(), 11, 31);
    const bucketEndDate = new Date(Math.min(yearEnd.getTime(), end.getTime()));
    const id = toDateId(bucketStartDate);
    buckets.push({
      id,
      label: String(cursor.getFullYear()),
      startDate: id,
      endDate: toDateId(bucketEndDate),
    });
    cursor = new Date(cursor.getFullYear() + 1, 0, 1);
  }

  return buckets;
}

function getEarliestKnownDateId(tasks: Task[], sessions: FocusSession[], dailyPlans: DailyPlan[], fallback: string) {
  return [
    ...tasks.flatMap((task) => [getDateIdFromTimestampLike(task.createdAt), getDateIdFromTimestampLike(task.completedAt), task.dueDate]),
    ...sessions.flatMap((session) => [session.dailyPlanDate, session.startedAt.slice(0, 10), session.completedAt?.slice(0, 10)]),
    ...dailyPlans.map((plan) => plan.date),
  ]
    .filter((date): date is string => Boolean(date && isDateId(date)))
    .sort()[0] ?? fallback;
}

function parseDateId(dateId: string) {
  return new Date(`${dateId}T00:00:00`);
}

function toDateId(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function diffDays(startDate: string, endDate: string) {
  return Math.max(0, Math.round((parseDateId(endDate).getTime() - parseDateId(startDate).getTime()) / MS_PER_DAY));
}

function formatShortDate(dateId: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(parseDateId(dateId));
}

function isDateId(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}
