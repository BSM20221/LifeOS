import { BarChart3, Database, Filter, RefreshCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyPlan, FocusMode, FocusSession, Project, ProjectArea, ReportingDataset, ReportingFilters, ReportingTableRow, TagCount, Task, TaskPriority } from "../types";
import { removeDemoAnalyticsData, seedDemoAnalyticsData } from "../demoDataUtils";
import {
  buildReportingDataset,
  getDefaultReportingFilters,
  reportTypeOptions,
  reportingRangeOptions,
  reportingViewModeOptions,
} from "../reportingUtils";
import { Badge, Button, EmptyState } from "./Common";

const projectAreas: Array<ProjectArea | "Uncategorized"> = ["Study", "Business", "Health", "Client Work", "Personal", "Other", "Uncategorized"];
const priorities: TaskPriority[] = ["urgent", "high", "medium", "low"];
const focusModes: FocusMode[] = ["pomodoro", "short-break", "long-break", "custom"];

export function ReportingDashboard({
  userId,
  tasks,
  projects,
  focusSessions,
  dailyPlans,
  tagCounts,
  todayDateId,
}: {
  userId: string;
  tasks: Task[];
  projects: Project[];
  focusSessions: FocusSession[];
  dailyPlans: DailyPlan[];
  tagCounts: TagCount[];
  todayDateId: string;
}) {
  const [filters, setFilters] = useState<ReportingFilters>(() => getDefaultReportingFilters());
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoMessage, setDemoMessage] = useState("");
  const [demoError, setDemoError] = useState("");
  const dataset = useMemo(
    () =>
      buildReportingDataset({
        tasks,
        projects,
        focusSessions,
        dailyPlans,
        filters,
        todayDateId,
      }),
    [dailyPlans, filters, focusSessions, projects, tasks, todayDateId]
  );
  const activeFilterChips = useMemo(() => getActiveFilterChips(filters, projects), [filters, projects]);

  const updateFilters = (next: Partial<ReportingFilters>) => {
    setFilters((current) => ({ ...current, ...next }));
  };

  const handleSeedDemo = async () => {
    setDemoBusy(true);
    setDemoError("");
    setDemoMessage("");
    try {
      await seedDemoAnalyticsData(userId);
      setDemoMessage("Demo analytics data added.");
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Could not seed demo analytics data.");
    } finally {
      setDemoBusy(false);
    }
  };

  const handleRemoveDemo = async () => {
    setDemoBusy(true);
    setDemoError("");
    setDemoMessage("");
    try {
      const result = await removeDemoAnalyticsData(userId);
      const removedCount = result.projects + result.tasks + result.focusSessions + result.dailyPlans;
      setDemoMessage(removedCount > 0 ? "Demo analytics data removed." : "No demo data was found.");
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Could not remove demo analytics data.");
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <section className="reporting-dashboard" aria-labelledby="reporting-title">
      <div className="reporting-dashboard-header">
        <div>
          <p className="eyebrow">Reporting</p>
          <h3 id="reporting-title">Filtered performance reports</h3>
          <p>Use this mode when you want a specific answer by date range, project, area, tag, priority, or focus mode.</p>
        </div>
        <Badge tone={filters.includeDemoData ? "info" : "neutral"}>{filters.includeDemoData ? "Demo data visible" : "Real data only"}</Badge>
      </div>

      <div className="reporting-layout">
        <ReportingFilterSidebar filters={filters} projects={projects} tags={tagCounts} onChange={updateFilters} />
        <div className="reporting-main">
          <ReportingMetricStrip metrics={dataset.metrics} />
          <ReportingChartCard dataset={dataset} activeFilterChips={activeFilterChips} />
          <div className="reporting-support-grid">
            <ReportingExplanationCard dataset={dataset} />
            <ReportingRecommendations dataset={dataset} />
          </div>
          <ReportingSummaryTable dataset={dataset} />
          {import.meta.env.DEV ? (
            <DemoDataPanel
              busy={demoBusy}
              message={demoMessage}
              error={demoError}
              onSeed={handleSeedDemo}
              onRemove={handleRemoveDemo}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ReportingFilterSidebar({
  filters,
  projects,
  tags,
  onChange,
}: {
  filters: ReportingFilters;
  projects: Project[];
  tags: TagCount[];
  onChange: (next: Partial<ReportingFilters>) => void;
}) {
  return (
    <aside className="reporting-filter-panel" aria-label="Reporting filters">
      <details className="reporting-filter-details" open>
        <summary>
          <Filter size={16} />
          <span>Reporting filters</span>
        </summary>
        <div className="reporting-filter-grid">
          <section className="reporting-filter-section" aria-label="Report filters">
            <h4>Report</h4>
            <label className="form-field reporting-field">
              <span>Report type</span>
              <select value={filters.reportType} onChange={(event) => onChange({ reportType: event.target.value as ReportingFilters["reportType"] })}>
                {reportTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="reporting-filter-section" aria-label="Time filters">
            <h4>Time</h4>
            <label className="form-field reporting-field">
              <span>Date range</span>
              <select value={filters.range} onChange={(event) => onChange({ range: event.target.value as ReportingFilters["range"] })}>
                {reportingRangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {filters.range === "custom" ? (
              <div className="reporting-date-pair">
                <label className="form-field reporting-field">
                  <span>Start</span>
                  <input type="date" value={filters.customStart} onChange={(event) => onChange({ customStart: event.target.value })} />
                </label>
                <label className="form-field reporting-field">
                  <span>End</span>
                  <input type="date" value={filters.customEnd} onChange={(event) => onChange({ customEnd: event.target.value })} />
                </label>
              </div>
            ) : null}

            <label className="form-field reporting-field">
              <span>View mode</span>
              <select value={filters.viewMode} onChange={(event) => onChange({ viewMode: event.target.value as ReportingFilters["viewMode"] })}>
                {reportingViewModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="reporting-filter-section" aria-label="Scope filters">
            <h4>Scope</h4>
            <label className="form-field reporting-field">
              <span>Project</span>
              <select value={filters.projectId} onChange={(event) => onChange({ projectId: event.target.value as ReportingFilters["projectId"] })}>
                <option value="all">All projects</option>
                <option value="uncategorized">Uncategorized</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.emoji ? `${project.emoji} ` : ""}
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field reporting-field">
              <span>Area</span>
              <select value={filters.area} onChange={(event) => onChange({ area: event.target.value as ReportingFilters["area"] })}>
                <option value="all">All areas</option>
                {projectAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field reporting-field">
              <span>Tag</span>
              <select value={filters.tag} onChange={(event) => onChange({ tag: event.target.value })}>
                <option value="all">All tags</option>
                {tags.map((tag) => (
                  <option key={tag.tag} value={tag.tag}>
                    #{tag.tag}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="reporting-filter-section" aria-label="Task filters">
            <h4>Task filters</h4>
            <label className="form-field reporting-field">
              <span>Priority</span>
              <select value={filters.priority} onChange={(event) => onChange({ priority: event.target.value as ReportingFilters["priority"] })}>
                <option value="all">All priorities</option>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field reporting-field">
              <span>Task status</span>
              <select value={filters.taskStatus} onChange={(event) => onChange({ taskStatus: event.target.value as ReportingFilters["taskStatus"] })}>
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="today">Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>

            <label className="form-field reporting-field">
              <span>Focus mode</span>
              <select value={filters.focusMode} onChange={(event) => onChange({ focusMode: event.target.value as ReportingFilters["focusMode"] })}>
                <option value="all">All modes</option>
                {focusModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="reporting-filter-section demo-filter-section" aria-label="Development demo data filters">
            <h4>Demo data</h4>
            <label className="reporting-check">
              <input type="checkbox" checked={filters.includeDemoData} onChange={(event) => onChange({ includeDemoData: event.target.checked })} />
              <span>
                Show development demo data
                <small>Hide this to inspect only your real records.</small>
              </span>
            </label>

            <Button type="button" variant="ghost" className="reporting-reset-button" onClick={() => onChange(getDefaultReportingFilters())}>
              <RefreshCcw size={16} />
              Reset filters
            </Button>
          </section>
        </div>
      </details>
    </aside>
  );
}

function ReportingMetricStrip({ metrics }: { metrics: ReportingDataset["metrics"] }) {
  return (
    <section className="reporting-metric-strip" aria-label="Report metrics">
      {metrics.map((metric) => (
        <article className={`reporting-metric ${metric.label.toLowerCase().includes("project") ? "text-metric" : ""}`} key={metric.label}>
          <span>{metric.label}</span>
          <strong title={metric.value}>{metric.value}</strong>
          <small>{metric.detail}</small>
        </article>
      ))}
    </section>
  );
}

function ReportingChartCard({ dataset, activeFilterChips }: { dataset: ReportingDataset; activeFilterChips: string[] }) {
  const hasData = dataset.chartData.some((row) => dataset.series.some((series) => Number(row[series.key] ?? 0) > 0));
  const horizontal = dataset.title.includes("comparison") || dataset.title.includes("Priority") || dataset.title.includes("Tag");
  const activeBucketCount = dataset.chartData.filter((row) => dataset.series.some((series) => Number(row[series.key] ?? 0) > 0)).length;
  const lowData = hasData && activeBucketCount <= 1 && !horizontal;

  return (
    <article className="reporting-chart-card panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">
            <BarChart3 size={14} />
            {dataset.subtitle}
          </p>
          <h3>{dataset.title}</h3>
          <div className="reporting-active-chips" aria-label="Active report filters">
            {activeFilterChips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        </div>
      </div>
      <ReportingLegend series={dataset.series} chartData={dataset.chartData} title={dataset.title} />
      <p className="reporting-axis-hint">{getAxisHint(dataset.title, horizontal)}</p>
      {lowData ? (
        <div className="reporting-low-data-note" role="note">
          <strong>Low data:</strong> Only one data bucket is available. Use a wider range, use LifeOS for a few more days, or seed demo data to see trends.
        </div>
      ) : null}
      {hasData ? (
        <div className={`reporting-chart-frame ${lowData ? "compact" : ""}`} role="img" aria-label={dataset.summary}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataset.chartData} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 12, right: 18, bottom: 12, left: horizontal ? 96 : 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30, 41, 59, 0.12)" />
              {horizontal ? <XAxis type="number" tick={{ fontSize: 12 }} /> : <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} minTickGap={10} />}
              {horizontal ? <YAxis dataKey={getCategoryKey(dataset)} type="category" width={150} tick={{ fontSize: 12 }} /> : <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />}
              <Tooltip
                formatter={(value, name) => [formatTooltipValue(value, dataset.title), String(name)]}
                labelFormatter={(label) => `${horizontal ? "Category" : "Bucket"}: ${String(label)}`}
                contentStyle={{ borderRadius: 12, border: "1px solid rgba(30, 41, 59, 0.12)" }}
              />
              {dataset.series.map((series) => (
                <Bar key={series.key} dataKey={series.key} name={series.label} fill={series.color} stackId={shouldStack(dataset.title) ? "total" : undefined} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ReportingEmptyState title={dataset.emptyTitle} message={dataset.emptyMessage} />
      )}
      <ChartExplanation summary={dataset.summary} />
    </article>
  );
}

function ReportingLegend({ series, chartData, title }: { series: ReportingDataset["series"]; chartData: ReportingDataset["chartData"]; title: string }) {
  return (
    <div className="reporting-legend" aria-label="Chart legend">
      {series.map((item) => (
        <span key={item.key}>
          <i style={{ background: item.color }} />
          <b>{item.label}</b>
          <em>{formatLegendTotal(getLegendTotal(chartData, item.key), title)}</em>
        </span>
      ))}
    </div>
  );
}

function ReportingEmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="reporting-empty-chart">
      <EmptyState title={title} message={message} />
    </div>
  );
}

function ChartExplanation({ summary }: { summary: string }) {
  return (
    <p className="chart-accessible-summary">
      <strong>Chart summary:</strong> {summary}
    </p>
  );
}

function ReportingExplanationCard({ dataset }: { dataset: ReportingDataset }) {
  return (
    <article className="reporting-explanation-card panel">
      <p className="eyebrow">What this means</p>
      <h4>{dataset.explanation.title}</h4>
      <p>{dataset.explanation.message}</p>
    </article>
  );
}

function ReportingRecommendations({ dataset }: { dataset: ReportingDataset }) {
  return (
    <article className="reporting-recommendations panel">
      <p className="eyebrow">Recommendations</p>
      <h4>Next practical moves</h4>
      <div className="recommendation-list compact">
        {dataset.recommendations.map((recommendation) => (
          <article className={`reporting-recommendation-item ${recommendation.severity}`} key={recommendation.id}>
            <div className="reporting-recommendation-header">
              <strong>{recommendation.title}</strong>
              <Badge tone={severityTone(recommendation.severity)}>{recommendation.severity}</Badge>
            </div>
            <p>{recommendation.message}</p>
            <small>{recommendation.action}</small>
          </article>
        ))}
      </div>
    </article>
  );
}

function ReportingSummaryTable({ dataset }: { dataset: ReportingDataset }) {
  if (dataset.rows.length === 0) {
    return <EmptyState title="No summary rows" message={dataset.emptyMessage} />;
  }

  return (
    <article className="reporting-summary-table panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Summary table</p>
          <h3>{dataset.title} details</h3>
        </div>
      </div>
      <div className="reporting-table-wrap">
        <table>
          <thead>
            <tr>
              {dataset.columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.rows.map((row, index) => (
              <tr key={`${dataset.title}-${index}`}>
                {dataset.columns.map((column) => (
                  <td key={column.key} data-label={column.label}>
                    {formatTableValue(row, column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function DemoDataPanel({
  busy,
  message,
  error,
  onSeed,
  onRemove,
}: {
  busy: boolean;
  message: string;
  error: string;
  onSeed: () => void;
  onRemove: () => void;
}) {
  return (
    <article className="demo-data-panel panel">
      <div>
        <p className="eyebrow">Development demo data</p>
        <h4>Preview richer reports</h4>
        <p>Development-only sample projects, tasks, focus sessions, and daily plans.</p>
        <p className="demo-data-note">Remove only deletes docs marked <code>isDemoData: true</code>.</p>
      </div>
      <div className="demo-data-actions">
        <Button type="button" variant="primary" onClick={onSeed} disabled={busy}>
          <Database size={16} />
          Seed demo data
        </Button>
        <Button type="button" variant="danger" onClick={onRemove} disabled={busy}>
          <Trash2 size={16} />
          Remove demo data
        </Button>
      </div>
      {message ? <p className="demo-data-status success" role="status">{message}</p> : null}
      {error ? <p className="demo-data-status error" role="alert">{error}</p> : null}
    </article>
  );
}

function getCategoryKey(dataset: ReportingDataset) {
  if (dataset.rows.some((row) => "project" in row)) {
    return "project";
  }
  if (dataset.rows.some((row) => "area" in row)) {
    return "area";
  }
  if (dataset.rows.some((row) => "tag" in row)) {
    return "tag";
  }
  if (dataset.rows.some((row) => "priority" in row)) {
    return "priority";
  }
  return "label";
}

function shouldStack(title: string) {
  return title === "Focus minutes" || title === "Completed tasks" || title === "Priority completion";
}

function getActiveFilterChips(filters: ReportingFilters, projects: Project[]) {
  const report = reportTypeOptions.find((option) => option.value === filters.reportType)?.label ?? "Report";
  const range = reportingRangeOptions.find((option) => option.value === filters.range)?.label ?? "Date range";
  const viewMode = reportingViewModeOptions.find((option) => option.value === filters.viewMode)?.label ?? "View";
  const project =
    filters.projectId === "all"
      ? "All projects"
      : filters.projectId === "uncategorized"
        ? "Uncategorized"
        : projects.find((item) => item.id === filters.projectId)?.name ?? "Selected project";
  const chips = [report, range, viewMode, project];

  if (filters.area !== "all") {
    chips.push(filters.area);
  }
  if (filters.tag !== "all") {
    chips.push(`#${filters.tag}`);
  }
  if (filters.priority !== "all") {
    chips.push(`${filters.priority} priority`);
  }
  if (filters.taskStatus !== "all") {
    chips.push(filters.taskStatus);
  }
  if (filters.focusMode !== "all") {
    chips.push(filters.focusMode);
  }

  return chips;
}

function severityTone(severity: ReportingDataset["recommendations"][number]["severity"]) {
  if (severity === "success") {
    return "success";
  }
  if (severity === "warning") {
    return "warning";
  }
  if (severity === "danger") {
    return "danger";
  }
  return "info";
}

function getLegendTotal(chartData: ReportingTableRow[], key: string) {
  return chartData.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function formatLegendTotal(value: number, title: string) {
  if (title.includes("Focus") || title.includes("focus")) {
    return `${value} min`;
  }
  return String(value);
}

function formatTooltipValue(value: unknown, title: string) {
  const numericValue = Number(value ?? 0);
  if (title.includes("Focus") || title.includes("focus")) {
    return `${numericValue} min`;
  }
  if (title.includes("Priority")) {
    return `${numericValue} tasks`;
  }
  return numericValue;
}

function getAxisHint(title: string, horizontal: boolean) {
  if (horizontal) {
    return "X-axis shows values. Y-axis shows ranked categories.";
  }
  if (title === "Focus minutes") {
    return "X-axis shows time buckets. Y-axis shows completed focus minutes.";
  }
  if (title === "Completed tasks") {
    return "X-axis shows time buckets. Y-axis shows completed tasks.";
  }
  return "X-axis shows time buckets. Y-axis shows report values.";
}

function formatTableValue(row: ReportingTableRow, key: string) {
  const value = row[key];
  if (typeof value === "number" && key.toLowerCase().includes("minutes")) {
    return `${value} min`;
  }
  return String(value ?? "");
}
