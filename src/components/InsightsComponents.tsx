import { AlertTriangle, BarChart3, CheckCircle2, Clock3, FolderKanban, Target } from "lucide-react";
import type { ChartDatum, DailyPlan, FocusSession, InsightMessage, Project, Quote, TagCount, Task } from "../types";
import { getCompletedTasksByDay, getFocusMinutesByDay, getFocusMinutesByProject, getLast7Days, getOpenTasksByPriority, getOpenTasksByTag, getOverdueTasks, getProjectsWithNoRecentProgress } from "../insightsUtils";
import { formatMinutes } from "../todayUtils";
import { DailyQuoteCard } from "./QuoteComponents";
import { EmptyState, MetricCard } from "./Common";

export function InsightsPage({
  tasks,
  projects,
  focusSessions,
  dailyPlan,
  tagCounts,
  todayDateId,
  messages,
  quote,
  quoteFavorite,
  onRefreshQuote,
  onToggleFavoriteQuote,
}: {
  tasks: Task[];
  projects: Project[];
  focusSessions: FocusSession[];
  dailyPlan: DailyPlan;
  tagCounts: TagCount[];
  todayDateId: string;
  messages: InsightMessage[];
  quote: Quote;
  quoteFavorite: boolean;
  onRefreshQuote: () => void;
  onToggleFavoriteQuote: () => void;
}) {
  const days = getLast7Days(todayDateId);
  const completedByDay = getCompletedTasksByDay(tasks, days);
  const focusByDay = getFocusMinutesByDay(focusSessions, days);
  const focusByProject = getFocusMinutesByProject(focusSessions, projects, days);
  const openByPriority = getOpenTasksByPriority(tasks);
  const openByTag = getOpenTasksByTag(tagCounts);
  const overdueTasks = getOverdueTasks(tasks);
  const completedToday = completedByDay[completedByDay.length - 1]?.value ?? 0;
  const focusToday = focusByDay[focusByDay.length - 1]?.value ?? 0;
  const focusWeek = focusByDay.reduce((total, item) => total + item.value, 0);
  const completedWeek = completedByDay.reduce((total, item) => total + item.value, 0);
  const completedFocusToday = focusSessions.filter((session) => session.dailyPlanDate === todayDateId && session.status === "completed").length;
  const topProject = focusByProject[0];
  const plannedToday = tasks.filter((task) => task.status === "today").length;
  const stuckProjects = getProjectsWithNoRecentProgress(projects, tasks, focusSessions, days);

  return (
    <section className="insights-page">
      <section className="insights-hero-grid">
        <DailyQuoteCard quote={quote} favorite={quoteFavorite} onRefresh={onRefreshQuote} onToggleFavorite={onToggleFavoriteQuote} />
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Pattern notes</p>
              <h3>What to notice</h3>
            </div>
            <Target size={20} />
          </div>
          <InsightMessageList messages={messages} />
        </article>
      </section>

      <section className="metrics-grid insights-metrics" aria-label="Insight metrics">
        <MetricCard icon={CheckCircle2} label="Completed today" value={String(completedToday)} detail={`${completedWeek} this week`} />
        <MetricCard icon={Clock3} label="Focus today" value={formatMinutes(focusToday)} detail={`${formatMinutes(focusWeek)} this week`} />
        <MetricCard icon={BarChart3} label="Focus sessions" value={String(completedFocusToday)} detail="Completed today" />
        <MetricCard icon={FolderKanban} label="Top focus project" value={topProject?.label ?? "None"} detail={topProject ? formatMinutes(topProject.value) : "No focus this week"} />
        <MetricCard icon={AlertTriangle} label="Overdue" value={String(overdueTasks.length)} detail="Open overdue tasks" />
        <MetricCard icon={Target} label="Planned vs done" value={`${plannedToday}/${completedToday}`} detail={`${dailyPlan.topTaskIds.length} Top 3 selected`} />
      </section>

      <section className="chart-grid">
        <SimpleBarChart title="Focus minutes by day" description="Last 7 days" data={focusByDay} emptyMessage="No focus minutes yet." />
        <SimpleBarChart title="Completed tasks by day" description="Last 7 days" data={completedByDay} emptyMessage="No completed tasks yet." />
        <SimpleBarChart title="Focus by project" description="This week" data={focusByProject} emptyMessage="No project focus data yet." />
        <SimpleBarChart title="Open tasks by priority" description="Current open work" data={openByPriority} emptyMessage="No open tasks." />
        <SimpleBarChart title="Open tasks by tag" description="Largest task clusters" data={openByTag} emptyMessage="No tag data yet." />
        <article className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Project signal</p>
              <h3>No recent progress</h3>
            </div>
          </div>
          {stuckProjects.length === 0 ? <EmptyState title="No stuck projects" message="Every active project has recent completion or focus activity." /> : null}
          <div className="insight-project-list">
            {stuckProjects.slice(0, 5).map((project) => (
              <span key={project.id}>
                <strong>{project.emoji ? `${project.emoji} ${project.name}` : project.name}</strong>
                <small>Choose one next action.</small>
              </span>
            ))}
          </div>
        </article>
      </section>
    </section>
  );
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
  const maxValue = Math.max(...data.map((item) => item.value), 0);
  const hasData = data.some((item) => item.value > 0);

  return (
    <article className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{description}</p>
          <h3>{title}</h3>
        </div>
      </div>
      {!hasData ? <EmptyState title="No data yet" message={emptyMessage} /> : null}
      <div className="simple-bar-chart" aria-label={title}>
        {data.map((item) => {
          const width = maxValue > 0 ? Math.max(6, (item.value / maxValue) * 100) : 0;
          return (
            <div className="bar-row" key={item.label}>
              <span>{item.label}</span>
              <div className="bar-track">
                <strong style={{ width: `${width}%`, background: item.color ?? undefined }} />
              </div>
              <em>{item.value}</em>
            </div>
          );
        })}
      </div>
    </article>
  );
}
