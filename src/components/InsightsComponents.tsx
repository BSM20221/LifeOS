import { BarChart3, CheckCircle2, Clock3, FolderKanban, Target } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type {
  AnalyticsRange,
  AreaPerformance,
  ChartDatum,
  DailyPlan,
  DateBucket,
  FocusSession,
  InsightMessage,
  PerformanceRecommendation,
  PlannedVsCompletedStats,
  PriorityCompletionStats,
  Project,
  ProjectPerformance,
  Quote,
  TagCount,
  TagPerformanceStats,
  Task,
} from "../types";
import {
  formatInsightNumber,
  formatMinutes,
  generatePerformanceRecommendations,
  getAreaPerformance,
  getCompletedTasksByDay,
  getCompletedTasksInRange,
  getDateRange,
  getFocusByProject,
  getFocusMinutesByDay,
  getFocusMinutesInRange,
  getFocusSessionsInRange,
  getOpenTasksByArea,
  getOverdueTasks,
  getOverdueTasksByProject,
  getPlannedVsCompletedStats,
  getPriorityCompletionStats,
  getProjectPerformance,
  getRangeBuckets,
  getTagPerformance,
  type AnalyticsDateRange,
} from "../insightsUtils";
import { getCompletedFocusMinutes, resolveFocusSessionProjectId } from "../focusUtils";
import { EmptyState, MetricCard } from "./Common";
import { DailyQuoteCard } from "./QuoteComponents";
import { ReportingDashboard } from "./ReportingComponents";

const rangeOptions: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7-days", label: "7 days" },
  { value: "30-days", label: "30 days" },
  { value: "this-month", label: "This month" },
  { value: "this-year", label: "This year" },
  { value: "all-time", label: "All time" },
  { value: "custom", label: "Custom" },
];

const chartPalette = {
  completed: "#2a5f48",
  focus: "#3d7b91",
  open: "#d79a37",
  overdue: "#b54a3f",
  planned: "#9a7a3f",
  topThree: "#6554a8",
  timeBlocks: "#5f7f43",
};

type ComparisonMetric = {
  key: string;
  label: string;
  unit: string;
  color: string;
};

type ComparisonRow = {
  label: string;
  detail?: string;
  color?: string;
  values: Record<string, number>;
};

type StackSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

type StackRow = {
  label: string;
  segments: StackSegment[];
};

type TopThreeDatum = ChartDatum & {
  planned: number;
};

export function InsightsPage({
  userId,
  tasks,
  projects,
  focusSessions,
  dailyPlan,
  dailyPlans,
  tagCounts,
  todayDateId,
  messages,
  quote,
  quoteFavorite,
  onRefreshQuote,
  onToggleFavoriteQuote,
}: {
  userId: string;
  tasks: Task[];
  projects: Project[];
  focusSessions: FocusSession[];
  dailyPlan: DailyPlan;
  dailyPlans: DailyPlan[];
  tagCounts: TagCount[];
  todayDateId: string;
  messages: InsightMessage[];
  quote: Quote;
  quoteFavorite: boolean;
  onRefreshQuote: () => void;
  onToggleFavoriteQuote: () => void;
}) {
  const [activeView, setActiveView] = useState<"overview" | "reporting">("overview");
  const [selectedRange, setSelectedRange] = useState<AnalyticsRange>("7-days");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const plansForAnalytics = useMemo(() => (dailyPlans.length > 0 ? dailyPlans : [dailyPlan]), [dailyPlan, dailyPlans]);
  const analyticsRange = useMemo(
    () =>
      getDateRange({
        range: selectedRange,
        todayDateId,
        customStart,
        customEnd,
        tasks,
        sessions: focusSessions,
        dailyPlans: plansForAnalytics,
      }),
    [customEnd, customStart, focusSessions, plansForAnalytics, selectedRange, tasks, todayDateId]
  );
  const buckets = useMemo(() => getRangeBuckets(analyticsRange), [analyticsRange]);
  const completedTrend = useMemo(() => getCompletedTasksByDay(tasks, buckets), [buckets, tasks]);
  const focusTrend = useMemo(() => getFocusMinutesByDay(focusSessions, buckets), [buckets, focusSessions]);
  const focusByProject = useMemo(() => getFocusByProject(focusSessions, projects, analyticsRange, tasks), [analyticsRange, focusSessions, projects, tasks]);
  const openTasksByArea = useMemo(() => getOpenTasksByArea(tasks, projects), [projects, tasks]);
  const overdueByProject = useMemo(() => getOverdueTasksByProject(tasks, projects), [projects, tasks]);
  const priorityStats = useMemo(() => getPriorityCompletionStats(tasks, analyticsRange), [analyticsRange, tasks]);
  const plannedStats = useMemo(() => getPlannedVsCompletedStats(tasks, plansForAnalytics, analyticsRange), [analyticsRange, plansForAnalytics, tasks]);
  const tagPerformance = useMemo(() => getTagPerformance(tasks, analyticsRange), [analyticsRange, tasks]);
  const projectPerformance = useMemo(() => getProjectPerformance(projects, tasks, focusSessions, analyticsRange, todayDateId), [analyticsRange, focusSessions, projects, tasks, todayDateId]);
  const areaPerformance = useMemo(() => getAreaPerformance(tasks, projects, focusSessions, analyticsRange, todayDateId), [analyticsRange, focusSessions, projects, tasks, todayDateId]);
  const recommendations = useMemo(
    () =>
      generatePerformanceRecommendations({
        tasks,
        projects,
        sessions: focusSessions,
        dailyPlans: plansForAnalytics,
        dailyPlan,
        tagCounts,
        todayDateId,
        range: analyticsRange,
      }),
    [analyticsRange, dailyPlan, focusSessions, plansForAnalytics, projects, tagCounts, tasks, todayDateId]
  );

  const completedInRange = getCompletedTasksInRange(tasks, analyticsRange).length;
  const focusSessionsInRange = getFocusSessionsInRange(focusSessions, analyticsRange);
  const focusMinutes = getFocusMinutesInRange(focusSessions, analyticsRange);
  const completedFocusSessions = focusSessionsInRange.filter((session) => session.status === "completed").length;
  const averageFocusMinutes = completedFocusSessions > 0 ? focusMinutes / completedFocusSessions : 0;
  const focusDiagnostic = getFocusDiagnostic(focusSessionsInRange, tasks, focusMinutes);
  const overdueTasks = getOverdueTasks(tasks);
  const topFocusProject = focusByProject.find((item) => item.value > 0) ?? null;
  const topThreeTrend = getTopThreeTrend(tasks, plansForAnalytics, buckets);
  const summary = getPerformanceSummary(projectPerformance, areaPerformance);
  const projectRows = getProjectComparisonRows(projectPerformance);
  const areaRows = getAreaComparisonRows(areaPerformance);

  return (
    <section className="insights-page advanced-insights">
      <section className="insights-header-panel panel">
        <div>
          <p className="eyebrow">Insights</p>
          <h3>{activeView === "overview" ? "Clear signals, not noise" : "Detailed reporting"}</h3>
          <p>
            {activeView === "overview"
              ? "Start here for the few patterns that should change what you do next."
              : "Use Reporting when you need filters, tables, and chart-level detail."}
          </p>
        </div>
        <div className="insights-header-controls">
          <div className="insights-view-switch" role="tablist" aria-label="Insights view">
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "overview"}
              className={activeView === "overview" ? "active" : ""}
              onClick={() => setActiveView("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeView === "reporting"}
              className={activeView === "reporting" ? "active" : ""}
              onClick={() => setActiveView("reporting")}
            >
              Reporting
            </button>
          </div>
          {activeView === "overview" ? (
            <AnalyticsRangeSelector
              value={selectedRange}
              onChange={setSelectedRange}
              customStart={customStart}
              customEnd={customEnd}
              onCustomStartChange={setCustomStart}
              onCustomEndChange={setCustomEnd}
            />
          ) : null}
        </div>
      </section>

      {activeView === "reporting" ? (
        <ReportingDashboard
          userId={userId}
          tasks={tasks}
          projects={projects}
          focusSessions={focusSessions}
          dailyPlans={plansForAnalytics}
          tagCounts={tagCounts}
          todayDateId={todayDateId}
        />
      ) : (
        <>

      <PerformanceSummary summary={summary} rangeLabel={analyticsRange.label} />

      <InsightsSection title="Overview" eyebrow={analyticsRange.label} description="Totals and the strongest signal for this range.">
        <section className="insights-hero-grid">
          <DailyQuoteCard quote={quote} favorite={quoteFavorite} onRefresh={onRefreshQuote} onToggleFavorite={onToggleFavoriteQuote} />
          <article className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Warnings & recommendations</p>
                <h3>What to act on</h3>
              </div>
              <Target size={20} />
            </div>
            <RecommendationList recommendations={recommendations.length > 0 ? recommendations.slice(0, 4) : messagesToRecommendations(messages)} />
          </article>
        </section>

        <section className="metrics-grid insights-metrics" aria-label="Insight metrics">
          <MetricCard icon={CheckCircle2} label="Completed" value={String(completedInRange)} detail={`${analyticsRange.label} tasks`} />
          <MetricCard icon={Clock3} label="Focus time" value={formatMinutes(focusMinutes)} detail="completed focus minutes" />
          <MetricCard icon={BarChart3} label="Sessions" value={String(focusSessionsInRange.length)} detail={`${completedFocusSessions} completed`} />
          <MetricCard icon={Clock3} label="Average focus" value={formatMinutes(averageFocusMinutes)} detail={completedFocusSessions > 0 ? "per completed session" : focusDiagnostic.shortMessage} />
          <TopFocusProjectMetric project={topFocusProject} diagnostic={focusDiagnostic.projectMessage} />
          <MetricCard icon={Target} label="Planned vs done" value={`${plannedStats.completed}/${plannedStats.planned}`} detail={`${plannedStats.topThreeCompleted}/${plannedStats.topThreePlanned} Top 3 done`} />
        </section>
      </InsightsSection>

      <InsightsSection title="Trends" eyebrow="Tasks and focus" description="Completed tasks and focus minutes over the selected range.">
        <section className="chart-grid insights-chart-grid">
          <AnalyticsLineChart
            title="Focus minutes trend"
            subtitle={`Total ${formatMinutes(focusMinutes)} across ${analyticsRange.label.toLowerCase()}`}
            data={focusTrend}
            unit="min"
            emptyMessage={focusDiagnostic.chartEmptyMessage}
            explanation={focusTrend.some((item) => item.value > 0) ? `Your strongest focus bucket is ${highestLabel(focusTrend, "min")}.` : "Complete a focus session and this chart will show momentum."}
          />
          <AnalyticsBarChart
            title="Completed tasks trend"
            subtitle={`${completedInRange} tasks completed in ${analyticsRange.label.toLowerCase()}`}
            data={completedTrend}
            unit="tasks"
            emptyMessage="Complete tasks or focus sessions to generate this chart."
            explanation={completedTrend.some((item) => item.value > 0) ? `Your strongest completion bucket is ${highestLabel(completedTrend, "tasks")}.` : "No task completion signal exists in this range yet."}
          />
          <AnalyticsBarChart
            title="Top 3 completion"
            subtitle="Only dates with saved Top 3 planning data"
            data={topThreeTrend}
            unit="done"
            emptyMessage="No Top 3 history yet. Use Today planning for a few days."
            explanation={topThreeTrend.length > 0 ? `You completed ${topThreeTrend.reduce((total, item) => total + item.value, 0)} planned Top 3 priorities in this range.` : "Top 3 charts stay hidden until daily plan data exists."}
          />
          <OverduePressureCard overdueTasks={overdueTasks.length} overdueByProject={overdueByProject} rangeLabel={analyticsRange.label} />
        </section>
      </InsightsSection>

      <InsightsSection title="Projects" eyebrow="Project attention" description="Compare completed work, focus time, open work, and overdue pressure by project.">
        <section className="chart-grid insights-chart-grid">
          <AnalyticsGroupedBarChart
            title="Project comparison"
            subtitle="Completed tasks, focus minutes, open tasks, and overdue tasks"
            rows={projectRows}
            metrics={comparisonMetrics}
            emptyMessage="No project activity in this range."
            explanation={projectRows.length > 1 ? compareRows(projectRows, "focus", "focus minutes") : "Assign tasks and focus sessions to projects to compare German, Coding, UoPeople, SEO, Health, Business, and other work."}
          />
          <CategoryShareChart
            title="Focus share by project"
            subtitle="Percentage of focused minutes"
            data={focusByProject}
            unit="min"
            emptyMessage={focusDiagnostic.projectMessage}
            explanation={focusByProject.length > 0 ? `Most focused attention went to ${focusByProject[0].label}.` : focusDiagnostic.projectMessage}
          />
        </section>

        <div className="performance-card-grid">
          {projectPerformance.slice(0, 8).map((project) => (
            <PerformanceCard key={project.projectId} item={project} />
          ))}
        </div>
      </InsightsSection>

      <InsightsSection title="Areas" eyebrow="Life area load" description="Study, Business, Health, Client Work, Personal, Other, and Uncategorized compared separately.">
        <section className="chart-grid insights-chart-grid">
          <AnalyticsGroupedBarChart
            title="Area comparison"
            subtitle="Completed tasks, focus minutes, open tasks, and overdue tasks"
            rows={areaRows}
            metrics={comparisonMetrics}
            emptyMessage="No area data yet."
            explanation={areaRows.length > 1 ? compareRows(areaRows, "completed", "completed tasks") : "Areas use project.area first, then tags for unassigned tasks."}
          />
          <AnalyticsStackedBarChart
            title="Open work by area"
            subtitle="Current active load"
            rows={openTasksByArea.map((area) => ({
              label: area.label,
              segments: [{ key: "open", label: "Open", value: area.value, color: chartPalette.open }],
            }))}
            legend={[{ label: "Open", color: chartPalette.open }]}
            unit="tasks"
            emptyMessage="No open tasks."
            explanation="High open load without completed work or focus time is a sign to reduce scope or schedule work."
          />
        </section>

        <div className="performance-card-grid compact">
          {areaPerformance.map((area) => (
            <PerformanceCard key={area.area} item={area} />
          ))}
        </div>
      </InsightsSection>

      <InsightsSection title="Task load" eyebrow="Priority and planning" description="Important work, open load, and planned-vs-completed follow-through.">
        <section className="chart-grid insights-chart-grid">
          <PriorityBreakdownChart stats={priorityStats} />
          <PlannedVsCompletedCard stats={plannedStats} range={analyticsRange} />
          <TagPerformancePanel tags={tagPerformance} />
        </section>
      </InsightsSection>
        </>
      )}
    </section>
  );
}

export function AnalyticsRangeSelector({
  value,
  onChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: {
  value: AnalyticsRange;
  onChange: (value: AnalyticsRange) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
}) {
  return (
    <form className="analytics-range-selector" aria-label="Analytics time range">
      <label>
        Time range
        <select value={value} onChange={(event) => onChange(event.target.value as AnalyticsRange)}>
          {rangeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {value === "custom" ? (
        <>
          <label>
            Start
            <input type="date" value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} />
          </label>
          <label>
            End
            <input type="date" value={customEnd} onChange={(event) => onCustomEndChange(event.target.value)} />
          </label>
        </>
      ) : null}
    </form>
  );
}

export function PerformanceSummary({
  summary,
  rangeLabel,
}: {
  summary: ReturnType<typeof getPerformanceSummary>;
  rangeLabel: string;
}) {
  return (
    <section className="performance-summary-grid" aria-label={`Performance summary for ${rangeLabel}`}>
      <PerformanceSummaryCard tone="success" label="Best performing" item={summary.best} fallback="No strong area yet" />
      <PerformanceSummaryCard tone="warning" label="Needs attention" item={summary.attention} fallback="No weak signal yet" />
      <PerformanceSummaryCard tone="danger" label="Neglected" item={summary.neglected} fallback="No neglected area yet" />
    </section>
  );
}

export function PerformanceSummaryCard({
  tone,
  label,
  item,
  fallback,
}: {
  tone: "success" | "warning" | "danger";
  label: string;
  item: ProjectPerformance | AreaPerformance | null;
  fallback: string;
}) {
  return (
    <article className={`performance-summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{item ? getPerformanceName(item) : fallback}</strong>
      <p>{item ? getPerformanceReason(item) : "Complete tasks or focus sessions to generate a reliable comparison."}</p>
    </article>
  );
}

export function TopFocusProjectMetric({
  project,
  diagnostic,
}: {
  project: ChartDatum | null;
  diagnostic: string;
}) {
  return (
    <article className="metric-card top-focus-project-card">
      <div className="metric-icon">
        <FolderKanban size={20} />
      </div>
      <span>Top focus project</span>
      <strong>{project ? project.label : "None"}</strong>
      <small>{project ? project.detail ?? `${formatMinutes(project.value)} completed focus` : diagnostic}</small>
    </article>
  );
}

export function PerformanceCard({ item }: { item: ProjectPerformance | AreaPerformance }) {
  const isProject = "projectId" in item;
  const title = isProject ? item.name : item.area;
  const color = isProject ? item.color : "#2a5f48";

  return (
    <section className="performance-card" style={{ "--performance-color": color } as CSSProperties}>
      <div className="performance-card-header">
        <span className="project-color-dot" />
        <div>
          <strong>{item.emoji ? `${item.emoji} ${title}` : title}</strong>
          <small>{isProject ? item.area : "Life area"}</small>
        </div>
        <PerformanceStatusBadge status={item.status} />
      </div>
      <div className="performance-metrics">
        <span>
          <strong>{item.completedTasks}</strong>
          completed
        </span>
        <span>
          <strong>{formatMinutes(item.focusMinutes)}</strong>
          focus
        </span>
        <span>
          <strong>{item.openTasks}</strong>
          open
        </span>
        <span>
          <strong>{item.overdueTasks}</strong>
          overdue
        </span>
      </div>
      <div className="performance-score" aria-label={`Performance score ${item.score} out of 100`}>
        <span style={{ width: `${Math.min(100, item.score)}%` }} />
      </div>
      <p>{item.message}</p>
      <small>{item.lastActivityDate ? `Last activity ${item.lastActivityDate}` : "No activity recorded yet"}</small>
    </section>
  );
}

export function PerformanceStatusBadge({ status }: { status: ProjectPerformance["status"] }) {
  return <em className={`performance-status ${status.toLowerCase().replace(/\s+/g, "-")}`}>{status}</em>;
}

export function RecommendationCard({ recommendation }: { recommendation: PerformanceRecommendation }) {
  return (
    <section className={`recommendation-card ${recommendation.severity}`}>
      <div>
        <strong>{recommendation.title}</strong>
        <p>{recommendation.message}</p>
      </div>
      <span>{recommendation.action}</span>
    </section>
  );
}

export function RecommendationList({ recommendations }: { recommendations: PerformanceRecommendation[] }) {
  if (recommendations.length === 0) {
    return <EmptyState title="Not enough data yet" message="Complete tasks or focus sessions and recommendations will become specific." />;
  }

  return (
    <div className="recommendation-list">
      {recommendations.map((recommendation) => (
        <RecommendationCard key={recommendation.id} recommendation={recommendation} />
      ))}
    </div>
  );
}

export function AnalyticsLineChart({
  title,
  subtitle,
  data,
  unit,
  emptyMessage,
  explanation,
}: {
  title: string;
  subtitle: string;
  data: ChartDatum[];
  unit: string;
  emptyMessage: string;
  explanation: string;
}) {
  const hasData = data.some((item) => item.value > 0);
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const width = 680;
  const height = 260;
  const padding = { top: 32, right: 28, bottom: 54, left: 48 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const points = data.map((item, index) => {
    const x = data.length === 1 ? padding.left + chartWidth / 2 : padding.left + (index / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - (item.value / maxValue) * chartHeight;
    return { ...item, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const labelStep = Math.max(1, Math.ceil(data.length / 7));

  return (
    <ChartShell title={title} subtitle={subtitle} empty={!hasData} emptyMessage={emptyMessage} explanation={explanation}>
      <svg className="analytics-svg-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}. ${explanation}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + chartHeight - tick * chartHeight;
          return (
            <g key={tick}>
              <line className="chart-grid-line" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
              <text className="chart-axis-label" x={padding.left - 10} y={y + 4} textAnchor="end">
                {Math.round(maxValue * tick)}
              </text>
            </g>
          );
        })}
        <line className="chart-axis-line" x1={padding.left} x2={padding.left} y1={padding.top} y2={height - padding.bottom} />
        <line className="chart-axis-line" x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} />
        {hasData ? <polyline className="chart-line" points={polyline} /> : null}
        {points.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle className="chart-point" cx={point.x} cy={point.y} r={point.value > 0 ? 5 : 3} />
            {point.value > 0 ? (
              <text className="chart-value-label" x={point.x} y={point.y - 10} textAnchor="middle">
                {formatInsightNumber(point.value)}
              </text>
            ) : null}
            {index % labelStep === 0 || index === points.length - 1 ? (
              <text className="chart-axis-label" x={point.x} y={height - 24} textAnchor="middle">
                {point.label}
              </text>
            ) : null}
          </g>
        ))}
        <text className="chart-unit-label" x={width - padding.right} y={padding.top - 12} textAnchor="end">
          {unit}
        </text>
      </svg>
      <ChartDataSummary data={data} unit={unit} />
    </ChartShell>
  );
}

export function AnalyticsBarChart({
  title,
  subtitle,
  data,
  unit,
  emptyMessage,
  explanation,
}: {
  title: string;
  subtitle: string;
  data: ChartDatum[];
  unit: string;
  emptyMessage: string;
  explanation: string;
}) {
  const hasData = data.some((item) => item.value > 0);
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const width = 680;
  const height = 260;
  const padding = { top: 30, right: 24, bottom: 58, left: 46 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const slot = chartWidth / Math.max(1, data.length);
  const barWidth = Math.max(10, Math.min(38, slot * 0.62));
  const labelStep = Math.max(1, Math.ceil(data.length / 8));

  return (
    <ChartShell title={title} subtitle={subtitle} empty={!hasData} emptyMessage={emptyMessage} explanation={explanation}>
      <svg className="analytics-svg-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}. ${explanation}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = padding.top + chartHeight - tick * chartHeight;
          return (
            <g key={tick}>
              <line className="chart-grid-line" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
              <text className="chart-axis-label" x={padding.left - 10} y={y + 4} textAnchor="end">
                {Math.round(maxValue * tick)}
              </text>
            </g>
          );
        })}
        <line className="chart-axis-line" x1={padding.left} x2={width - padding.right} y1={height - padding.bottom} y2={height - padding.bottom} />
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * chartHeight;
          const x = padding.left + index * slot + (slot - barWidth) / 2;
          const y = padding.top + chartHeight - barHeight;
          return (
            <g key={`${title}-${item.label}-${index}`}>
              <rect className="chart-bar" x={x} y={y} width={barWidth} height={barHeight} rx="5" style={{ fill: item.color ?? chartPalette.completed }} />
              {item.value > 0 ? (
                <text className="chart-value-label" x={x + barWidth / 2} y={y - 8} textAnchor="middle">
                  {formatInsightNumber(item.value)}
                </text>
              ) : null}
              {index % labelStep === 0 || index === data.length - 1 ? (
                <text className="chart-axis-label" x={x + barWidth / 2} y={height - 24} textAnchor="middle">
                  {item.label}
                </text>
              ) : null}
            </g>
          );
        })}
        <text className="chart-unit-label" x={width - padding.right} y={padding.top - 12} textAnchor="end">
          {unit}
        </text>
      </svg>
      <ChartDataSummary data={data} unit={unit} />
    </ChartShell>
  );
}

export function AnalyticsGroupedBarChart({
  title,
  subtitle,
  rows,
  metrics,
  emptyMessage,
  explanation,
}: {
  title: string;
  subtitle: string;
  rows: ComparisonRow[];
  metrics: ComparisonMetric[];
  emptyMessage: string;
  explanation: string;
}) {
  const hasData = rows.some((row) => metrics.some((metric) => row.values[metric.key] > 0));
  const maxByMetric = metrics.reduce<Record<string, number>>((acc, metric) => {
    acc[metric.key] = Math.max(...rows.map((row) => row.values[metric.key] ?? 0), 1);
    return acc;
  }, {});

  return (
    <ChartShell title={title} subtitle={subtitle} empty={!hasData} emptyMessage={emptyMessage} explanation={explanation}>
      <ChartLegend items={metrics.map((metric) => ({ label: `${metric.label} (${metric.unit})`, color: metric.color }))} />
      <div className="analytics-grouped-chart" role="img" aria-label={`${title}. ${explanation}`}>
        {rows.map((row) => (
          <div className="analytics-grouped-row" key={row.label}>
            <div className="analytics-row-label">
              <strong>{row.label}</strong>
              {row.detail ? <span>{row.detail}</span> : null}
            </div>
            <div className="analytics-grouped-bars">
              {metrics.map((metric) => {
                const value = row.values[metric.key] ?? 0;
                const width = value > 0 ? Math.max(5, (value / maxByMetric[metric.key]) * 100) : 0;
                return (
                  <div className="analytics-mini-bar" key={metric.key}>
                    <span>{metric.label}</span>
                    <div className="analytics-mini-track">
                      <strong style={{ width: `${width}%`, background: metric.color }} />
                    </div>
                    <em>
                      {formatInsightNumber(value)} {metric.unit}
                    </em>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <ChartDataSummary data={rows.flatMap((row) => metrics.map((metric) => ({ label: `${row.label} ${metric.label}`, value: row.values[metric.key] ?? 0 })))} unit="" />
    </ChartShell>
  );
}

export function AnalyticsStackedBarChart({
  title,
  subtitle,
  rows,
  legend,
  unit,
  emptyMessage,
  explanation,
}: {
  title: string;
  subtitle: string;
  rows: StackRow[];
  legend: Array<{ label: string; color: string }>;
  unit: string;
  emptyMessage: string;
  explanation: string;
}) {
  const hasData = rows.some((row) => row.segments.some((segment) => segment.value > 0));

  return (
    <ChartShell title={title} subtitle={subtitle} empty={!hasData} emptyMessage={emptyMessage} explanation={explanation}>
      <ChartLegend items={legend} />
      <div className="analytics-stacked-chart" role="img" aria-label={`${title}. ${explanation}`}>
        {rows.map((row) => {
          const total = row.segments.reduce((sum, segment) => sum + segment.value, 0);
          return (
            <div className="analytics-stacked-row" key={row.label}>
              <strong>{row.label}</strong>
              <div className="analytics-stacked-track">
                {row.segments.map((segment) => {
                  const width = total > 0 ? (segment.value / total) * 100 : 0;
                  return <span key={segment.key} style={{ width: `${width}%`, background: segment.color }} title={`${segment.label}: ${segment.value} ${unit}`} />;
                })}
              </div>
              <em>{formatInsightNumber(total)} {unit}</em>
              <small>{row.segments.map((segment) => `${segment.label}: ${segment.value}`).join(" · ")}</small>
            </div>
          );
        })}
      </div>
    </ChartShell>
  );
}

export function CategoryShareChart({
  title,
  subtitle,
  data,
  unit,
  emptyMessage,
  explanation,
}: {
  title: string;
  subtitle: string;
  data: ChartDatum[];
  unit: string;
  emptyMessage: string;
  explanation: string;
}) {
  const hasData = data.some((item) => item.value > 0);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const segments = buildDonutSegments(data);

  return (
    <ChartShell title={title} subtitle={subtitle} empty={!hasData} emptyMessage={emptyMessage} explanation={explanation}>
      <div className="category-share-chart" role="img" aria-label={`${title}. ${explanation}`}>
        <div className="donut-chart" style={{ "--donut-gradient": segments.gradient } as CSSProperties}>
          <span>
            <strong>{formatInsightNumber(total)}</strong>
            {unit}
          </span>
        </div>
        <ChartLegend
          items={segments.items.map((item) => ({
            label: `${item.label} · ${formatInsightNumber(item.value)} ${unit} · ${item.percent}%`,
            color: item.color,
          }))}
        />
      </div>
    </ChartShell>
  );
}

export function ChartLegend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="chart-legend" aria-label="Chart legend">
      {items.map((item) => (
        <span key={item.label}>
          <i style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ProjectFocusChart({ data }: { data: ChartDatum[] }) {
  return (
    <AnalyticsStackedBarChart
      title="Focus by project"
      subtitle="Top projects by focused minutes"
      rows={data.map((item) => ({
        label: item.label,
        segments: [{ key: "focus", label: "Focus", value: item.value, color: item.color ?? chartPalette.focus }],
      }))}
      legend={[{ label: "Focus minutes", color: chartPalette.focus }]}
      unit="min"
      emptyMessage="No project-linked focus sessions in this range."
      explanation={data.length > 0 ? `You focused most on ${data[0].label}.` : "Start a project-linked focus session to make this chart useful."}
    />
  );
}

export function PriorityBreakdownChart({ stats }: { stats: PriorityCompletionStats[] }) {
  const rows = getPriorityRows(stats);
  const urgentHighOpen = stats.filter((item) => item.priority === "urgent" || item.priority === "high").reduce((total, item) => total + item.open, 0);
  const lowCompleted = stats.find((item) => item.priority === "low")?.completed ?? 0;
  const warning = urgentHighOpen > 0 && lowCompleted > 0;

  return (
    <AnalyticsStackedBarChart
      title="Priority completion"
      subtitle="Urgent, high, medium, and low"
      rows={rows}
      legend={[
        { label: "Completed", color: chartPalette.completed },
        { label: "Open", color: chartPalette.open },
        { label: "Overdue", color: chartPalette.overdue },
      ]}
      unit="tasks"
      emptyMessage="No priority task data yet."
      explanation={
        warning
          ? "Priority warning: low-priority work is moving while urgent or high-priority tasks remain open. Pick one urgent/high task for Top 3."
          : getPriorityExplanation(stats)
      }
    />
  );
}

export function PlannedVsCompletedCard({ stats, range }: { stats: PlannedVsCompletedStats; range: AnalyticsDateRange }) {
  const completionPercent = stats.planned > 0 ? Math.round((stats.completed / stats.planned) * 100) : 0;
  const visualPercent = Math.min(100, completionPercent);
  const timeBlockPercent = stats.timeBlocksPlanned > 0 ? Math.round((stats.timeBlocksCompleted / stats.timeBlocksPlanned) * 100) : 0;
  const explanation =
    stats.planned === 0
      ? "No saved plan data in this range yet."
      : completionPercent > 100
        ? `You completed more than planned: ${completionPercent}% of planned tasks. The visual bar is capped at 100%.`
        : `You completed ${completionPercent}% of planned tasks and ${timeBlockPercent}% of planned time blocks.`;

  return (
    <article className="panel chart-panel planned-vs-completed-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{range.label}</p>
          <h3>Planned vs completed</h3>
        </div>
      </div>
      <div className="planned-stat-grid">
        <span>
          <strong>{stats.planned}</strong>
          planned tasks
        </span>
        <span>
          <strong>{stats.completed}</strong>
          completed tasks
        </span>
        <span>
          <strong>{stats.topThreeCompleted}/{stats.topThreePlanned}</strong>
          Top 3 done
        </span>
        <span>
          <strong>{stats.timeBlocksCompleted}/{stats.timeBlocksPlanned}</strong>
          time blocks done
        </span>
      </div>
      <div className="planned-chart" aria-label={`Planned completion ${completionPercent}%`}>
        <div className="performance-score">
          <span style={{ width: `${visualPercent}%` }} />
        </div>
        <strong>{completionPercent}%</strong>
      </div>
      <ChartLegend
        items={[
          { label: "Completed", color: chartPalette.completed },
          { label: "Planned remaining", color: chartPalette.planned },
          { label: "Top 3 done", color: chartPalette.topThree },
          { label: "Time blocks done", color: chartPalette.timeBlocks },
        ]}
      />
      <div className="analytics-stacked-chart planned-components" role="img" aria-label="Planning components">
        {getPlanningRows(stats).map((row) => {
          const total = row.segments.reduce((sum, segment) => sum + segment.value, 0);
          return (
            <div className="analytics-stacked-row" key={row.label}>
              <strong>{row.label}</strong>
              <div className="analytics-stacked-track">
                {row.segments.map((segment) => (
                  <span
                    key={segment.key}
                    style={{ width: `${total > 0 ? (segment.value / total) * 100 : 0}%`, background: segment.color }}
                    title={`${segment.label}: ${segment.value}`}
                  />
                ))}
              </div>
              <em>{total} items</em>
              <small>{row.segments.map((segment) => `${segment.label}: ${segment.value}`).join(" · ")}</small>
            </div>
          );
        })}
      </div>
      <ChartExplanation text={explanation} />
    </article>
  );
}

export function OverduePressureCard({
  overdueTasks,
  overdueByProject,
  rangeLabel,
}: {
  overdueTasks: number;
  overdueByProject: ChartDatum[];
  rangeLabel: string;
}) {
  if (overdueTasks === 0) {
    return (
      <article className="panel chart-panel overdue-pressure-card positive">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{rangeLabel}</p>
            <h3>Overdue pressure</h3>
          </div>
        </div>
        <EmptyState title="No overdue pressure in this range" message="There are no current overdue tasks competing for attention." />
        <ChartExplanation text="This chart stays quiet when there is no overdue work instead of showing rows of zeros." />
      </article>
    );
  }

  return (
    <CategoryShareChart
      title="Overdue pressure"
      subtitle={`${overdueTasks} current overdue tasks`}
      data={overdueByProject}
      unit="tasks"
      emptyMessage="No overdue tasks in this range."
      explanation={`Overdue pressure is concentrated most in ${overdueByProject[0]?.label ?? "uncategorized work"}.`}
    />
  );
}

export function TagPerformancePanel({ tags }: { tags: TagPerformanceStats[] }) {
  return (
    <AnalyticsStackedBarChart
      title="Tag performance"
      subtitle="Open and completed by tag"
      rows={tags.slice(0, 10).map((tag) => ({
        label: `#${tag.tag}`,
        segments: [
          { key: "open", label: "Open", value: tag.openTasks, color: chartPalette.open },
          { key: "completed", label: "Completed", value: tag.completedTasks, color: chartPalette.completed },
        ],
      }))}
      legend={[
        { label: "Open", color: chartPalette.open },
        { label: "Completed", color: chartPalette.completed },
      ]}
      unit="tasks"
      emptyMessage="No tag data in this range."
      explanation={tags.length > 0 ? `#${tags[0].tag} is the largest active task cluster.` : "Tags will become useful once tasks have #tags."}
    />
  );
}

export function ChartEmptyState({ message }: { message: string }) {
  return <EmptyState title="Not enough data yet" message={message} />;
}

export function ChartExplanation({ text }: { text: string }) {
  return <p className="chart-explanation">{text}</p>;
}

export function InsightMessageList({ messages }: { messages: InsightMessage[] }) {
  if (messages.length === 0) {
    return <EmptyState title="No strong signals yet" message="Create tasks, complete work, and run focus sessions to generate useful insights." />;
  }

  return (
    <div className="insight-message-list">
      {messages.map((message) => (
        <InsightCard key={message.id} message={message} />
      ))}
    </div>
  );
}

export function InsightCard({ message }: { message: InsightMessage }) {
  return (
    <section className={`insight-card ${message.severity}`}>
      <strong>{message.title}</strong>
      <p>{message.message}</p>
    </section>
  );
}

export function SimpleBarChart({
  title,
  description,
  data,
  emptyMessage,
}: {
  title: string;
  description: string;
  data: ChartDatum[];
  emptyMessage: string;
}) {
  return <AnalyticsBarChart title={title} subtitle={description} data={data} unit="" emptyMessage={emptyMessage} explanation={description} />;
}

function ChartShell({
  title,
  subtitle,
  empty,
  emptyMessage,
  explanation,
  children,
}: {
  title: string;
  subtitle: string;
  empty: boolean;
  emptyMessage: string;
  explanation: string;
  children: ReactNode;
}) {
  return (
    <article className="panel chart-panel analytics-chart-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{subtitle}</p>
          <h3>{title}</h3>
        </div>
      </div>
      {empty ? <ChartEmptyState message={emptyMessage} /> : children}
      <ChartExplanation text={explanation} />
    </article>
  );
}

function InsightsSection({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="insights-section" aria-labelledby={`insights-${title.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="insights-section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3 id={`insights-${title.toLowerCase().replace(/\s+/g, "-")}`}>{title}</h3>
        </div>
        <p>{description}</p>
      </div>
      {children}
    </section>
  );
}

function getTopThreeTrend(tasks: Task[], dailyPlans: DailyPlan[], buckets: DateBucket[]): TopThreeDatum[] {
  return buckets
    .map((bucket) => {
      const plans = dailyPlans.filter((plan) => plan.date >= bucket.startDate && plan.date <= bucket.endDate && plan.topTaskIds.length > 0);
      const plannedIds = plans.flatMap((plan) => plan.topTaskIds);
      const completed = plannedIds.filter((taskId) => tasks.find((task) => task.id === taskId)?.status === "done").length;
      return {
        label: bucket.label,
        value: completed,
        planned: plannedIds.length,
        detail: `${completed}/${plannedIds.length} Top 3 tasks complete`,
      };
    })
    .filter((item) => item.planned > 0);
}

function getPerformanceSummary(projects: ProjectPerformance[], areas: AreaPerformance[]) {
  const items = [...projects, ...areas].filter((item) => item.completedTasks > 0 || item.focusMinutes > 0 || item.openTasks > 0 || item.overdueTasks > 0);
  const best = [...items].sort((left, right) => right.score - left.score || right.focusMinutes + right.completedTasks * 20 - (left.focusMinutes + left.completedTasks * 20))[0] ?? null;
  const attention = items.find((item) => item.status === "Stuck" || item.status === "Needs attention") ?? null;
  const neglected = items.find((item) => item.status === "Neglected") ?? null;
  return { best, attention, neglected };
}

function getFocusDiagnostic(sessions: FocusSession[], tasks: Task[], countedMinutes: number) {
  const completedSessions = sessions.filter((session) => session.status === "completed");
  const countedCompletedSessions = completedSessions.filter((session) => getCompletedFocusMinutes(session) > 0);
  const linkedCompletedSessions = countedCompletedSessions.filter((session) => resolveFocusSessionProjectId(session, tasks));

  if (sessions.length === 0) {
    return {
      shortMessage: "no sessions in range",
      chartEmptyMessage: "No focus sessions for this range.",
      projectMessage: "No completed focus minutes yet.",
    };
  }

  if (completedSessions.length === 0) {
    return {
      shortMessage: `${sessions.length} sessions, 0 completed`,
      chartEmptyMessage: `${sessions.length} focus sessions exist, but none are completed in this range.`,
      projectMessage: `${sessions.length} focus sessions exist, but none are completed in this range.`,
    };
  }

  if (countedMinutes <= 0 || countedCompletedSessions.length === 0) {
    return {
      shortMessage: `${completedSessions.length} completed, 0 min`,
      chartEmptyMessage: `${sessions.length} focus sessions exist, but their completed minutes are 0. Complete a timer session to generate focus analytics.`,
      projectMessage: "No completed focus minutes yet.",
    };
  }

  if (linkedCompletedSessions.length === 0) {
    return {
      shortMessage: `${completedSessions.length} completed`,
      chartEmptyMessage: "Completed focus minutes are available.",
      projectMessage: "Focus sessions exist, but they are not linked to projects.",
    };
  }

  return {
    shortMessage: `${completedSessions.length} completed`,
    chartEmptyMessage: "No focus sessions for this range.",
    projectMessage: "No completed focus data",
  };
}

function getPerformanceName(item: ProjectPerformance | AreaPerformance) {
  if ("projectId" in item) {
    return item.emoji ? `${item.emoji} ${item.name}` : item.name;
  }

  return item.emoji ? `${item.emoji} ${item.area}` : item.area;
}

function getPerformanceReason(item: ProjectPerformance | AreaPerformance) {
  if (item.status === "Strong" || item.status === "Healthy") {
    return `${formatMinutes(item.focusMinutes)} focus and ${item.completedTasks} completed tasks.`;
  }

  if (item.status === "Stuck") {
    return `${item.overdueTasks} overdue tasks and no recent progress.`;
  }

  if (item.status === "Neglected") {
    return `No completed tasks or focus time in this range.`;
  }

  return `${item.openTasks} open tasks, ${formatMinutes(item.focusMinutes)} focus, ${item.completedTasks} completed.`;
}

function getProjectComparisonRows(projects: ProjectPerformance[]): ComparisonRow[] {
  return projects
    .filter((project) => project.completedTasks > 0 || project.focusMinutes > 0 || project.openTasks > 0 || project.overdueTasks > 0)
    .slice(0, 10)
    .map((project) => ({
      label: project.emoji ? `${project.emoji} ${project.name}` : project.name,
      detail: `${project.status} · ${project.area}`,
      color: project.color,
      values: {
        completed: project.completedTasks,
        focus: project.focusMinutes,
        open: project.openTasks,
        overdue: project.overdueTasks,
      },
    }));
}

function getAreaComparisonRows(areas: AreaPerformance[]): ComparisonRow[] {
  return areas.map((area) => ({
    label: area.emoji ? `${area.emoji} ${area.area}` : area.area,
    detail: area.status,
    values: {
      completed: area.completedTasks,
      focus: area.focusMinutes,
      open: area.openTasks,
      overdue: area.overdueTasks,
    },
  }));
}

const comparisonMetrics: ComparisonMetric[] = [
  { key: "completed", label: "Done", unit: "tasks", color: chartPalette.completed },
  { key: "focus", label: "Focus", unit: "min", color: chartPalette.focus },
  { key: "open", label: "Open", unit: "tasks", color: chartPalette.open },
  { key: "overdue", label: "Overdue", unit: "tasks", color: chartPalette.overdue },
];

function getPriorityRows(stats: PriorityCompletionStats[]): StackRow[] {
  return stats.map((item) => ({
    label: item.priority,
    segments: [
      { key: "completed", label: "Completed", value: item.completed, color: chartPalette.completed },
      { key: "open", label: "Open", value: item.open, color: chartPalette.open },
      { key: "overdue", label: "Overdue", value: item.overdue, color: chartPalette.overdue },
    ],
  }));
}

function getPlanningRows(stats: PlannedVsCompletedStats): StackRow[] {
  return [
    {
      label: "Tasks",
      segments: [
        { key: "completed", label: "Completed", value: stats.completed, color: chartPalette.completed },
        { key: "planned-gap", label: "Planned remaining", value: Math.max(0, stats.planned - stats.completed), color: chartPalette.planned },
      ],
    },
    {
      label: "Top 3",
      segments: [
        { key: "top-done", label: "Done", value: stats.topThreeCompleted, color: chartPalette.topThree },
        { key: "top-open", label: "Remaining", value: Math.max(0, stats.topThreePlanned - stats.topThreeCompleted), color: chartPalette.planned },
      ],
    },
    {
      label: "Time blocks",
      segments: [
        { key: "blocks-done", label: "Done", value: stats.timeBlocksCompleted, color: chartPalette.timeBlocks },
        { key: "blocks-open", label: "Remaining", value: Math.max(0, stats.timeBlocksPlanned - stats.timeBlocksCompleted), color: chartPalette.planned },
      ],
    },
  ];
}

function messagesToRecommendations(messages: InsightMessage[]): PerformanceRecommendation[] {
  return messages.map((message) => ({
    id: message.id,
    title: message.title,
    message: message.message,
    severity: message.severity,
    action: "Review this signal.",
  }));
}

function highestLabel(data: ChartDatum[], unit: string) {
  const item = data.reduce<ChartDatum | null>((best, current) => (!best || current.value > best.value ? current : best), null);
  return item ? `${item.label} (${formatInsightNumber(item.value)} ${unit})` : "none";
}

function compareRows(rows: ComparisonRow[], key: string, label: string) {
  const sorted = [...rows].sort((left, right) => (right.values[key] ?? 0) - (left.values[key] ?? 0));
  const best = sorted[0];
  const weakest = [...rows].filter((row) => (row.values.open ?? 0) > 0).sort((left, right) => (left.values[key] ?? 0) - (right.values[key] ?? 0))[0];

  if (!best || !weakest || best.label === weakest.label) {
    return "Add more activity to make comparisons stronger.";
  }

  return `${best.label} is stronger than ${weakest.label} for ${label}.`;
}

function getPriorityExplanation(stats: PriorityCompletionStats[]) {
  const urgentHighOpen = stats.filter((item) => item.priority === "urgent" || item.priority === "high").reduce((total, item) => total + item.open, 0);
  const lowCompleted = stats.find((item) => item.priority === "low")?.completed ?? 0;
  const urgentHighCompleted = stats.filter((item) => item.priority === "urgent" || item.priority === "high").reduce((total, item) => total + item.completed, 0);

  if (urgentHighOpen > 0 && lowCompleted > urgentHighCompleted) {
    return "Low-priority work is moving faster than important work.";
  }

  if (urgentHighCompleted > 0) {
    return "Important tasks are getting completed in this range.";
  }

  return "Use priority completion to check whether urgent and high-priority work is actually moving.";
}

function buildDonutSegments(data: ChartDatum[]) {
  const colors = ["#2a5f48", "#3d7b91", "#d79a37", "#6554a8", "#b54a3f", "#5f7f43", "#9a7a3f", "#7a6f63"];
  const values = data.filter((item) => item.value > 0).slice(0, 8);
  const total = values.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const items = values.map((item, index) => {
    const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
    const start = cursor;
    cursor += percent;
    return {
      label: item.label,
      value: item.value,
      percent,
      color: item.color ?? colors[index % colors.length],
      start,
      end: cursor,
    };
  });
  const gradient =
    items.length === 0
      ? "#e3ddd2 0deg 360deg"
      : items
          .map((item, index) => {
            const start = index === 0 ? 0 : items[index - 1].end;
            const end = index === items.length - 1 ? 100 : item.end;
            return `${item.color} ${start}% ${end}%`;
          })
          .join(", ");

  return { gradient: `conic-gradient(${gradient})`, items };
}

function ChartDataSummary({ data, unit }: { data: ChartDatum[]; unit: string }) {
  const nonZero = data.filter((item) => item.value > 0);
  if (nonZero.length === 0) {
    return null;
  }

  return (
    <p className="chart-data-summary">
      Values: {nonZero.slice(0, 6).map((item) => `${item.label} ${formatInsightNumber(item.value)}${unit ? ` ${unit}` : ""}`).join(" · ")}
      {nonZero.length > 6 ? " · more" : ""}
    </p>
  );
}
