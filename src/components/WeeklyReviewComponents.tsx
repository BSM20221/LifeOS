import { BarChart3, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FolderKanban, Sparkles, Target } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { DailyPlan, FocusSession, Habit, Project, ProjectHealthStatus, Task, WeekId, WeeklyProjectAction, WeeklyReview } from "../types";
import { displayWithEmoji } from "../emojiPresets";
import { formatMinutes } from "../todayUtils";
import {
  calculateProjectHealth,
  calculateWeeklyFocusSummary,
  calculateWeeklyStats,
  createEmptyWeeklyReview,
  formatWeekRange,
  generateWeeklyInsights,
  getNextWeekId,
  getPreviousWeekId,
  getProjectActionLabel,
  getWeekRange,
  getWeeklyChartData,
  getHabitStatsForWeek,
  synthesizeDailyReflections,
  type WeeklyProjectSummary,
} from "../weeklyUtils";
import { Badge, Button, EmptyState, StatusBanner } from "./Common";
import { getFriendlyError } from "../utils";

export function WeeklyReviewPage({
  userId,
  weekId,
  review,
  exists,
  loading,
  saveState,
  tasks,
  projects,
  focusSessions,
  dailyPlans,
  habits,
  onWeekChange,
  onSave,
  onComplete,
  onReopen,
}: {
  userId: string;
  weekId: WeekId;
  review: WeeklyReview;
  exists: boolean;
  loading: boolean;
  saveState: { status: "idle" | "saving" | "saved" | "error"; message: string };
  tasks: Task[];
  projects: Project[];
  focusSessions: FocusSession[];
  dailyPlans: DailyPlan[];
  habits: Habit[];
  onWeekChange: (weekId: WeekId) => void;
  onSave: (review: WeeklyReview) => Promise<void>;
  onComplete: (review: WeeklyReview) => Promise<void>;
  onReopen: (review: WeeklyReview) => Promise<void>;
}) {
  const [draft, setDraft] = useState<WeeklyReview>(() => review ?? createEmptyWeeklyReview(userId, weekId));
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setLocalError("");
    if (hasUnsavedChanges && draft.weekId === weekId) {
      return;
    }

    setDraft(review ?? createEmptyWeeklyReview(userId, weekId));
    setLastSavedAt(formatReviewSavedTime(review?.updatedAt ?? null));
    setHasUnsavedChanges(false);
  }, [draft.weekId, hasUnsavedChanges, review, userId, weekId]);

  const range = useMemo(() => getWeekRange(weekId), [weekId]);
  const stats = useMemo(() => calculateWeeklyStats({ tasks, projects, sessions: focusSessions, habits, range }), [focusSessions, habits, projects, range, tasks]);
  const projectSummaries = useMemo(
    () =>
      projects
        .filter((project) => project.status === "active" || project.status === "paused")
        .map((project) => calculateProjectHealth(project, tasks, focusSessions, range)),
    [focusSessions, projects, range, tasks]
  );
  const habitSummaries = useMemo(() => getHabitStatsForWeek(habits, range), [habits, range]);
  const focusSummary = useMemo(() => calculateWeeklyFocusSummary(focusSessions, projects, tasks, range), [focusSessions, projects, range, tasks]);
  const charts = useMemo(() => getWeeklyChartData(tasks, focusSessions, habits, projects, range), [focusSessions, habits, projects, range, tasks]);
  const reflectionSynthesis = useMemo(() => synthesizeDailyReflections(dailyPlans, range), [dailyPlans, range]);
  const insights = useMemo(() => generateWeeklyInsights({ stats, projectSummaries, tasks }), [projectSummaries, stats, tasks]);
  const hasWeeklyActivity =
    stats.completedTasks > 0 ||
    stats.focusMinutes > 0 ||
    stats.completedFocusSessions > 0 ||
    stats.projectsTouched > 0 ||
    stats.topTagByCompleted !== "None";
  const openTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== "done" && task.status !== "archived")
        .sort((left, right) => priorityRank(right.priority) - priorityRank(left.priority))
        .slice(0, 18),
    [tasks]
  );

  const updateDraft = (updates: Partial<WeeklyReview>) => {
    setDraft((current) => {
      const nextDraft = { ...current, ...updates };
      if ("improveNextWeek" in updates && !("whatToImproveNextWeek" in updates)) {
        nextDraft.whatToImproveNextWeek = updates.improveNextWeek ?? "";
      }
      if ("whatToImproveNextWeek" in updates && !("improveNextWeek" in updates)) {
        nextDraft.improveNextWeek = updates.whatToImproveNextWeek ?? "";
      }
      if ("projectReviewActions" in updates && !("projectReviewStates" in updates)) {
        nextDraft.projectReviewStates = { ...updates.projectReviewActions };
      }
      return nextDraft;
    });
    setHasUnsavedChanges(true);
  };

  const toggleTask = (taskId: string) => {
    if (draft.nextWeekPriorityTaskIds.includes(taskId)) {
      updateDraft({ nextWeekPriorityTaskIds: draft.nextWeekPriorityTaskIds.filter((id) => id !== taskId) });
      return;
    }

    if (draft.nextWeekPriorityTaskIds.length >= 5) {
      setLocalError("Choose up to 5 next-week priority tasks.");
      return;
    }

    setLocalError("");
    updateDraft({ nextWeekPriorityTaskIds: [...draft.nextWeekPriorityTaskIds, taskId] });
  };

  const toggleProject = (projectId: string) => {
    if (draft.nextWeekProjectIds.includes(projectId)) {
      updateDraft({ nextWeekProjectIds: draft.nextWeekProjectIds.filter((id) => id !== projectId) });
      return;
    }

    if (draft.nextWeekProjectIds.length >= 3) {
      setLocalError("Choose up to 3 projects for next week.");
      return;
    }

    setLocalError("");
    updateDraft({ nextWeekProjectIds: [...draft.nextWeekProjectIds, projectId] });
  };

  const setProjectAction = (projectId: string, action: WeeklyProjectAction) => {
    const nextActions = { ...draft.projectReviewActions };
    if (nextActions[projectId] === action) {
      delete nextActions[projectId];
    } else {
      nextActions[projectId] = action;
    }
    updateDraft({
      projectReviewActions: nextActions,
    });
  };

  const handleSave = async () => {
    setLocalError("");
    try {
      await onSave(draft);
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setHasUnsavedChanges(false);
    } catch (error) {
      setLocalError(getFriendlyError(error));
    }
  };

  const handleComplete = async () => {
    try {
      await onComplete(draft);
      setDraft((current) => ({ ...current, completedAt: new Date().toISOString() }));
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setHasUnsavedChanges(false);
    } catch (error) {
      setLocalError(getFriendlyError(error));
    }
  };

  const handleReopen = async () => {
    try {
      await onReopen(draft);
      setDraft((current) => ({ ...current, completedAt: null }));
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setHasUnsavedChanges(false);
    } catch (error) {
      setLocalError(getFriendlyError(error));
    }
  };

  const saveStatus = getWeeklySaveStatus(saveState, hasUnsavedChanges, exists);
  const saveStatusLabel = getWeeklySaveStatusLabel(saveState, hasUnsavedChanges, exists, Boolean(draft.completedAt));
  const isSaving = saveState.status === "saving";
  const canSave = hasUnsavedChanges || saveState.status === "error" || !exists;

  return (
    <section className="weekly-review-page">
      <WeekSelector
        weekId={weekId}
        rangeLabel={formatWeekRange(range)}
        completedAt={draft.completedAt}
        saving={saveState.status === "saving"}
        status={saveStatus}
        saveStatus={saveStatusLabel}
        lastSavedAt={lastSavedAt}
        onWeekChange={onWeekChange}
      />
      <WeeklyStickySaveBar
        status={saveStatus}
        statusLabel={saveStatusLabel}
        lastSavedAt={lastSavedAt}
        saving={isSaving}
        completedAt={draft.completedAt}
        canSave={canSave}
        onSave={handleSave}
        onComplete={handleComplete}
        onReopen={handleReopen}
      />
      {loading && !hasUnsavedChanges ? <StatusBanner tone="info" message="Loading weekly review." /> : null}
      {!loading && !exists ? (
        <StatusBanner tone="info" message="No saved review for this week yet. Fill the fields and click Save review." />
      ) : null}
      {saveState.status === "error" && saveState.message ? <StatusBanner tone="error" message={saveState.message} /> : null}
      {localError ? <StatusBanner tone="error" message={localError} /> : null}

      <WeeklyInsightList
        insights={insights}
        hasWeeklyActivity={hasWeeklyActivity}
        hasHabits={habits.length > 0}
        hasDailyReflections={reflectionSynthesis.daysWithReflections > 0}
      />
      <WeeklySummaryCards stats={stats} completedAt={draft.completedAt} />

      <WeeklyChartSection charts={charts} />

      <section className="weekly-review-grid">
        <WeeklyReviewForm
          draft={draft}
          onChange={updateDraft}
          onSave={handleSave}
          saving={isSaving}
          canSave={canSave}
          saveStatus={saveStatusLabel}
          lastSavedAt={lastSavedAt}
        />
        <NextWeekPlanner
          draft={draft}
          projects={projects}
          tasks={openTasks}
          onToggleProject={toggleProject}
          onToggleTask={toggleTask}
          onNotesChange={(nextWeekNotes) => updateDraft({ nextWeekNotes })}
          onSave={handleSave}
          saving={isSaving}
          canSave={canSave}
          saveStatus={saveStatusLabel}
        />
      </section>

      <WeeklyProjectReview summaries={projectSummaries} actions={draft.projectReviewActions} onSetAction={setProjectAction} />
      <WeeklyHabitReview
        habits={habitSummaries}
        reflection={draft.habitReflection}
        onReflectionChange={(habitReflection) => updateDraft({ habitReflection })}
        onSave={handleSave}
        saving={isSaving}
        canSave={canSave}
        saveStatus={saveStatusLabel}
      />
      <WeeklyFocusReview
        summary={focusSummary}
        reflection={draft.focusReflection}
        onReflectionChange={(focusReflection) => updateDraft({ focusReflection })}
        onSave={handleSave}
        saving={isSaving}
        canSave={canSave}
        saveStatus={saveStatusLabel}
      />
      <DailyReflectionSynthesisPanel synthesis={reflectionSynthesis} />

    </section>
  );
}

function WeekSelector({
  weekId,
  rangeLabel,
  completedAt,
  saving,
  status,
  saveStatus,
  lastSavedAt,
  onWeekChange,
}: {
  weekId: WeekId;
  rangeLabel: string;
  completedAt: string | null;
  saving: boolean;
  status: "dirty" | "saving" | "saved" | "error" | "idle";
  saveStatus: string;
  lastSavedAt: string | null;
  onWeekChange: (weekId: WeekId) => void;
}) {
  return (
    <section className="weekly-hero panel">
      <div>
        <p className="eyebrow">Weekly Review</p>
        <h3>{rangeLabel}</h3>
        <p>{completedAt ? `Complete - ${new Date(completedAt).toLocaleString()}` : "Draft review"}</p>
        <span className={`weekly-save-status ${saving ? "saving" : status}`}>
          {saving ? "Saving..." : saveStatus}
        </span>
        {lastSavedAt ? <small className="weekly-last-saved">Last saved {lastSavedAt}</small> : null}
      </div>
      <div className="weekly-header-actions">
        <div className="week-selector-actions">
          <Button type="button" variant="secondary" onClick={() => onWeekChange(getPreviousWeekId(weekId))}>
            <ChevronLeft size={17} />
            Previous
          </Button>
          <Badge tone={completedAt ? "success" : "info"}>{completedAt ? "Complete" : weekId}</Badge>
          <Button type="button" variant="secondary" onClick={() => onWeekChange(getNextWeekId(weekId))}>
            Next
            <ChevronRight size={17} />
          </Button>
        </div>
      </div>
    </section>
  );
}

function WeeklyStickySaveBar({
  status,
  statusLabel,
  lastSavedAt,
  saving,
  completedAt,
  canSave,
  onSave,
  onComplete,
  onReopen,
}: {
  status: "dirty" | "saving" | "saved" | "error" | "idle";
  statusLabel: string;
  lastSavedAt: string | null;
  saving: boolean;
  completedAt: string | null;
  canSave: boolean;
  onSave: () => Promise<void>;
  onComplete: () => Promise<void>;
  onReopen: () => Promise<void>;
}) {
  const isComplete = Boolean(completedAt);
  const showSave = status === "dirty" || status === "error" || status === "idle";
  const showComplete = !isComplete && status === "saved";
  const showReopen = isComplete && status === "saved";
  const detail =
    status === "dirty"
      ? "You have unsaved changes. Save before leaving or refreshing."
      : status === "saving"
        ? "Writing this week review to Firestore."
        : status === "error"
          ? "Save failed. Your text is still in the form."
          : isComplete && completedAt
            ? `Review completed ${new Date(completedAt).toLocaleString()}`
            : lastSavedAt
              ? `Last saved ${lastSavedAt}`
              : "No saved review for this week yet.";

  return (
    <section className={`weekly-sticky-save ${status}`} aria-live="polite">
      <div>
        <strong>{saving ? "Saving..." : statusLabel}</strong>
        <span>{detail}</span>
      </div>
      <div className="weekly-sticky-actions">
        {showSave ? (
          <Button type="button" variant={status === "error" ? "primary" : "secondary"} onClick={() => void onSave()} disabled={saving || !canSave}>
            {status === "error" ? "Retry save" : "Save review"}
          </Button>
        ) : null}
        {showReopen ? (
          <Button type="button" variant="ghost" onClick={() => void onReopen()} disabled={saving}>
            Reopen
          </Button>
        ) : null}
        {showComplete ? (
          <Button type="button" variant="primary" onClick={() => void onComplete()} disabled={saving}>
            Mark complete
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function WeeklySummaryCards({ stats, completedAt }: { stats: ReturnType<typeof calculateWeeklyStats>; completedAt: string | null }) {
  return (
    <section className="weekly-summary-grid" aria-label="Weekly summary">
      <WeeklyStat icon={<CheckCircle2 size={18} />} label="Tasks completed" value={String(stats.completedTasks)} detail="this week" />
      <WeeklyStat icon={<Clock3 size={18} />} label="Focus minutes" value={formatMinutes(stats.focusMinutes)} detail={`${stats.completedFocusSessions} sessions`} />
      <WeeklyStat icon={<Target size={18} />} label="Habit completion" value={stats.habitCompletionRate === null ? "N/A" : `${stats.habitCompletionRate}%`} detail={`${stats.habitsCompleted} completions`} />
      <WeeklyStat icon={<CalendarDays size={18} />} label="Overdue tasks" value={String(stats.overdueTasks)} detail="still overdue" />
      <WeeklyStat icon={<FolderKanban size={18} />} label="Projects touched" value={String(stats.projectsTouched)} detail={stats.topProjectByFocus} />
      <WeeklyStat icon={<Sparkles size={18} />} label="Top tag" value={stats.topTagByCompleted} detail={completedAt ? "review complete" : "draft review"} />
    </section>
  );
}

function WeeklyStat({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="weekly-stat-card">
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{detail}</em>
    </article>
  );
}

function WeeklyInsightList({
  insights,
  hasWeeklyActivity,
  hasHabits,
  hasDailyReflections,
}: {
  insights: ReturnType<typeof generateWeeklyInsights>;
  hasWeeklyActivity: boolean;
  hasHabits: boolean;
  hasDailyReflections: boolean;
}) {
  const supplementalCards = (
    <>
      {!hasHabits ? (
        <article className="weekly-insight-card info">
          <Badge tone="info">info</Badge>
          <strong>No habit data yet</strong>
          <p>Add habits to include habit stability in weekly reviews.</p>
        </article>
      ) : null}
      {!hasDailyReflections ? (
        <article className="weekly-insight-card info">
          <Badge tone="info">info</Badge>
          <strong>No daily reflections recorded this week</strong>
          <p>Daily reflection patterns will appear after you record reflections on the Today page.</p>
        </article>
      ) : null}
    </>
  );

  if (insights.length === 0) {
    if (hasWeeklyActivity) {
      return (
        <section className="weekly-insight-grid">
          <article className="weekly-insight-card info">
            <Badge tone="info">info</Badge>
            <strong>Weekly activity is available</strong>
            <p>You have task and focus data for this week. Add habits and daily reflections for a fuller review.</p>
          </article>
          {supplementalCards}
        </section>
      );
    }

    return <EmptyState title="No weekly activity yet" message="Complete tasks, focus sessions, habits, or daily reflections to generate weekly insights." />;
  }

  return (
    <section className="weekly-insight-grid">
      {insights.map((insight) => (
        <article className={`weekly-insight-card ${insight.severity}`} key={insight.id}>
          <Badge tone={insight.severity}>{insight.severity}</Badge>
          <strong>{insight.title}</strong>
          <p>{insight.message}</p>
        </article>
      ))}
      {supplementalCards}
    </section>
  );
}

function WeeklyChartSection({ charts }: { charts: ReturnType<typeof getWeeklyChartData> }) {
  return (
    <section className="weekly-chart-grid">
      <WeeklyBarChart title="Completed tasks by day" unit="tasks" data={charts.completedTasksByDay} empty="No completed tasks this week." />
      <WeeklyBarChart title="Focus minutes by day" unit="min" data={charts.focusMinutesByDay} empty="No focus sessions this week." />
      <WeeklyBarChart title="Habit completion by day" unit="%" data={charts.habitCompletionByDay} empty="No habit data this week." maxValue={100} />
      <WeeklyBarChart title="Focus by project" unit="min" data={charts.focusByProject} empty="No project-linked focus data yet." />
      <WeeklyBarChart title="Tasks completed by project" unit="tasks" data={charts.completedByProject} empty="No project completion data this week." />
    </section>
  );
}

function WeeklyBarChart({ title, unit, data, empty, maxValue }: { title: string; unit: string; data: Array<{ label: string; value: number }>; empty: string; maxValue?: number }) {
  const visibleData = data.filter((item) => item.value > 0);
  const chartData = visibleData.length > 0 ? visibleData : data;
  const max = maxValue ?? Math.max(1, ...chartData.map((item) => item.value));

  return (
    <article className="weekly-chart-card panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Weekly graph</p>
          <h3>{title}</h3>
        </div>
        <BarChart3 size={18} />
      </div>
      {visibleData.length === 0 ? <EmptyState title="No data" message={empty} /> : null}
      <div className="weekly-bars" aria-label={title}>
        {chartData.map((item) => (
          <div className="weekly-bar-row" key={item.label}>
            <span>{item.label}</span>
            <div className="weekly-bar-track">
              <i style={{ width: `${Math.min(100, Math.round((item.value / max) * 100))}%` }} />
            </div>
            <em>
              {item.value} {unit}
            </em>
          </div>
        ))}
      </div>
    </article>
  );
}

function WeeklyReviewForm({
  draft,
  onChange,
  onSave,
  saving,
  canSave,
  saveStatus,
  lastSavedAt,
}: {
  draft: WeeklyReview;
  onChange: (updates: Partial<WeeklyReview>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  canSave: boolean;
  saveStatus: string;
  lastSavedAt: string | null;
}) {
  return (
    <article className="weekly-form-card panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Reflection</p>
          <h3>Review the week</h3>
          <p className="panel-copy">Use these questions to understand what happened this week and choose better actions for next week.</p>
          <p className={`weekly-save-help ${saveStatus === "Unsaved changes" ? "dirty" : ""}`}>
            {saveStatus === "Unsaved changes"
              ? "You have unsaved changes. Use Save review before leaving or refreshing."
              : "These answers belong to this week's review. The save bar shows when changes need saving."}
          </p>
        </div>
      </div>
      <div className="weekly-form-sections">
        <section className="review-section-card">
          <h4>Wins and challenges</h4>
          <div className="weekly-form-grid">
            <WeeklyTextArea label="What went well?" value={draft.topWins} onChange={(topWins) => onChange({ topWins })} />
            <WeeklyTextArea label="What was difficult?" value={draft.biggestStruggles} onChange={(biggestStruggles) => onChange({ biggestStruggles })} />
            <WeeklyTextArea label="What did I learn?" value={draft.lessonsLearned} onChange={(lessonsLearned) => onChange({ lessonsLearned })} />
            <WeeklyTextArea
              label="What should I improve next week?"
              value={draft.whatToImproveNextWeek || draft.improveNextWeek}
              onChange={(whatToImproveNextWeek) => onChange({ whatToImproveNextWeek, improveNextWeek: whatToImproveNextWeek })}
            />
          </div>
        </section>

        <section className="review-section-card">
          <h4>Stop, continue, start</h4>
          <div className="weekly-form-grid">
            <WeeklyTextArea label="What should I stop doing?" value={draft.whatToStopDoing} onChange={(whatToStopDoing) => onChange({ whatToStopDoing })} />
            <WeeklyTextArea label="What should I continue doing?" value={draft.whatToContinueDoing} onChange={(whatToContinueDoing) => onChange({ whatToContinueDoing })} />
            <WeeklyTextArea label="What should I start doing?" value={draft.whatToStartDoing} onChange={(whatToStartDoing) => onChange({ whatToStartDoing })} />
          </div>
        </section>

        <section className="review-section-card">
          <h4>Energy and mood</h4>
          <div className="weekly-form-grid compact">
            <WeeklyTextArea label="How was my energy?" value={draft.energySummary} onChange={(energySummary) => onChange({ energySummary })} />
            <WeeklyTextArea label="How was my mood?" value={draft.moodSummary} onChange={(moodSummary) => onChange({ moodSummary })} />
            <label className="weekly-field">
              <span>Overall rating 1-10</span>
              <input type="number" min="1" max="10" value={draft.rating ?? ""} onChange={(event) => onChange({ rating: event.target.value ? Math.min(10, Math.max(1, Number(event.target.value))) : null })} />
            </label>
          </div>
        </section>
      </div>
      <WeeklySectionSaveControls onSave={onSave} saving={saving} canSave={canSave} saveStatus={saveStatus} lastSavedAt={lastSavedAt} />
    </article>
  );
}

function WeeklyTextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="weekly-field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
    </label>
  );
}

function WeeklySectionSaveControls({
  onSave,
  saving,
  canSave,
  saveStatus,
  lastSavedAt,
}: {
  onSave: () => Promise<void>;
  saving: boolean;
  canSave: boolean;
  saveStatus: string;
  lastSavedAt?: string | null;
}) {
  return (
    <div className="weekly-section-save">
      <span>
        {saveStatus}
        {lastSavedAt ? ` - Last saved ${lastSavedAt}` : ""}
      </span>
      <Button type="button" variant={canSave ? "primary" : "secondary"} onClick={() => void onSave()} disabled={saving || !canSave}>
        {saving ? "Saving..." : "Save review"}
      </Button>
    </div>
  );
}

function NextWeekPlanner({
  draft,
  projects,
  tasks,
  onToggleProject,
  onToggleTask,
  onNotesChange,
  onSave,
  saving,
  canSave,
  saveStatus,
}: {
  draft: WeeklyReview;
  projects: Project[];
  tasks: Task[];
  onToggleProject: (projectId: string) => void;
  onToggleTask: (taskId: string) => void;
  onNotesChange: (value: string) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  canSave: boolean;
  saveStatus: string;
}) {
  const activeProjects = projects.filter((project) => project.status === "active" || project.status === "paused");
  return (
    <article className="weekly-form-card panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Next week</p>
          <h3>Choose priorities</h3>
        </div>
      </div>
      <div className="weekly-planner-section">
        <strong>Projects to focus on ({draft.nextWeekProjectIds.length}/3)</strong>
        <div className="weekly-chip-grid">
          {activeProjects.map((project) => (
            <button className={draft.nextWeekProjectIds.includes(project.id) ? "selected" : ""} type="button" key={project.id} onClick={() => onToggleProject(project.id)}>
              {displayWithEmoji(project.name, project.emoji)}
            </button>
          ))}
        </div>
      </div>
      <div className="weekly-planner-section">
        <strong>Priority tasks ({draft.nextWeekPriorityTaskIds.length}/5)</strong>
        {tasks.length === 0 ? (
          <EmptyState
            title="No open tasks"
            message="Open tasks will appear here for next-week planning."
            action={
              <div className="weekly-empty-actions">
                <a className="primary-button" href="#inbox">
                  Create a new task
                </a>
                <a className="secondary-button" href="#inbox">
                  Go to Inbox
                </a>
                <a className="secondary-button" href="#projects">
                  Review projects
                </a>
              </div>
            }
          />
        ) : null}
        <div className="weekly-task-pick-list">
          {tasks.map((task) => (
            <label key={task.id}>
              <input type="checkbox" checked={draft.nextWeekPriorityTaskIds.includes(task.id)} onChange={() => onToggleTask(task.id)} />
              <span>
                <strong>{displayWithEmoji(task.title, task.emoji)}</strong>
                <small>{task.priority} priority</small>
              </span>
            </label>
          ))}
        </div>
      </div>
      <WeeklyTextArea label="Optional notes for next week" value={draft.nextWeekNotes} onChange={onNotesChange} />
      <WeeklySectionSaveControls onSave={onSave} saving={saving} canSave={canSave} saveStatus={saveStatus} />
    </article>
  );
}

function WeeklyProjectReview({ summaries, actions, onSetAction }: { summaries: WeeklyProjectSummary[]; actions: WeeklyReview["projectReviewActions"]; onSetAction: (projectId: string, action: WeeklyProjectAction) => void }) {
  return (
    <article className="panel weekly-wide-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Project review</p>
          <h3>Project health this week</h3>
        </div>
      </div>
      {summaries.length === 0 ? <EmptyState title="No active projects" message="Active project health appears here after projects are created." /> : null}
      <div className="weekly-project-grid">
        {summaries.map((summary) => (
          <section className="weekly-project-card" key={summary.project.id} style={{ "--project-color": summary.project.color } as CSSProperties}>
            <div className="weekly-project-header">
              <span className="project-color-dot" />
              <strong>{displayWithEmoji(summary.project.name, summary.project.emoji)}</strong>
              <ProjectHealthBadge status={summary.health} />
            </div>
            <div className="weekly-project-metrics">
              <span>{summary.openTasks} open</span>
              <span>{summary.completedTasks} done</span>
              <span>{formatMinutes(summary.focusMinutes)}</span>
            </div>
            <p>{summary.reason}</p>
            <small>{summary.lastActivityDate ? `Last activity ${summary.lastActivityDate}` : "No activity recorded"}</small>
            <div className="weekly-project-actions">
              {(["continue", "pause", "cleanup"] as WeeklyProjectAction[]).map((action) => (
                <button className={actions[summary.project.id] === action ? "active" : ""} type="button" key={action} onClick={() => onSetAction(summary.project.id, action)}>
                  {getProjectActionLabel(action)}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}

function ProjectHealthBadge({ status }: { status: ProjectHealthStatus }) {
  const tone = status === "healthy" ? "success" : status === "paused" ? "neutral" : status === "stuck" ? "danger" : "warning";
  return <Badge tone={tone}>{status}</Badge>;
}

function WeeklyHabitReview({
  habits,
  reflection,
  onReflectionChange,
  onSave,
  saving,
  canSave,
  saveStatus,
}: {
  habits: ReturnType<typeof getHabitStatsForWeek>;
  reflection: string;
  onReflectionChange: (value: string) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  canSave: boolean;
  saveStatus: string;
}) {
  return (
    <article className="panel weekly-wide-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Habit review</p>
          <h3>Habit stability</h3>
        </div>
      </div>
      {habits.length === 0 ? (
        <EmptyState
          title="No habit data yet"
          message="Add habits to include habit stability in weekly reviews."
          action={
            <a className="primary-button" href="#habits">
              Open Habits
            </a>
          }
        />
      ) : (
        <div className="weekly-list">
          {habits.map((habit) => (
            <div className="weekly-list-row" key={habit.habitId}>
              <strong>{displayWithEmoji(habit.name, habit.emoji)}</strong>
              <span>{habit.completions}/{habit.targetPerWeek} target - {habit.completionRate}% - {habit.missedDays} missed - {habit.streak} day streak</span>
            </div>
          ))}
        </div>
      )}
      <WeeklyTextArea label="What made habits easier or harder this week?" value={reflection} onChange={onReflectionChange} />
      <WeeklySectionSaveControls onSave={onSave} saving={saving} canSave={canSave} saveStatus={saveStatus} />
    </article>
  );
}

function WeeklyFocusReview({
  summary,
  reflection,
  onReflectionChange,
  onSave,
  saving,
  canSave,
  saveStatus,
}: {
  summary: ReturnType<typeof calculateWeeklyFocusSummary>;
  reflection: string;
  onReflectionChange: (value: string) => void;
  onSave: () => Promise<void>;
  saving: boolean;
  canSave: boolean;
  saveStatus: string;
}) {
  return (
    <article className="panel weekly-wide-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Focus review</p>
          <h3>Focus reflection</h3>
        </div>
      </div>
      <div className="weekly-focus-grid">
        <WeeklyStat icon={<Clock3 size={18} />} label="Focus minutes" value={formatMinutes(summary.focusMinutes)} detail={`${summary.completedSessions} sessions`} />
        <WeeklyStat icon={<TimerIcon />} label="Average session" value={formatMinutes(summary.averageSessionMinutes)} detail={summary.bestFocusDay} />
      </div>
      {summary.focusByProject.length === 0 ? (
        <EmptyState
          title="No focus sessions"
          message="Start and complete a focus session to see focus by project."
          action={
            <a className="primary-button" href="#focus">
              Start focus
            </a>
          }
        />
      ) : null}
      <div className="weekly-list">
        {summary.focusByProject.slice(0, 5).map((item) => (
          <div className="weekly-list-row" key={item.projectId ?? "none"}>
            <strong>{displayWithEmoji(item.name, item.emoji)}</strong>
            <span>{formatMinutes(item.minutes)}</span>
          </div>
        ))}
      </div>
      <WeeklyTextArea label="When did I focus best? What distracted me? What should I protect next week?" value={reflection} onChange={onReflectionChange} />
      <WeeklySectionSaveControls onSave={onSave} saving={saving} canSave={canSave} saveStatus={saveStatus} />
    </article>
  );
}

function TimerIcon() {
  return <Clock3 size={18} />;
}

function DailyReflectionSynthesisPanel({ synthesis }: { synthesis: ReturnType<typeof synthesizeDailyReflections> }) {
  return (
    <article className="panel weekly-wide-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Daily reflections</p>
          <h3>Reflection synthesis</h3>
        </div>
      </div>
      {synthesis.daysWithReflections === 0 ? (
        <EmptyState
          title="No daily reflections recorded this week"
          message="Daily reflection patterns will appear here after you record reflections on the Today page."
          action={
            <a className="primary-button" href="#today">
              Go to Today
            </a>
          }
        />
      ) : (
        <div className="weekly-reflection-grid">
          <div>
            <strong>{synthesis.daysWithReflections}</strong>
            <span>days with reflections</span>
          </div>
          <div>
            <strong>{synthesis.energySummary}</strong>
            <span>{synthesis.moodSummary}</span>
          </div>
          <div>
            <strong>Distractions</strong>
            <span>{synthesis.distractions.length > 0 ? synthesis.distractions.join(" | ") : "None recorded"}</span>
          </div>
          <div>
            <strong>Improvements</strong>
            <span>{synthesis.improvements.length > 0 ? synthesis.improvements.join(" | ") : "None recorded"}</span>
          </div>
        </div>
      )}
    </article>
  );
}

function priorityRank(priority: Task["priority"]) {
  return priority === "urgent" ? 4 : priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}

function getWeeklySaveStatus(
  saveState: { status: "idle" | "saving" | "saved" | "error"; message: string },
  hasUnsavedChanges: boolean,
  exists: boolean
): "dirty" | "saving" | "saved" | "error" | "idle" {
  if (saveState.status === "saving") {
    return "saving";
  }

  if (hasUnsavedChanges) {
    return "dirty";
  }

  if (saveState.status === "error") {
    return "error";
  }

  if (saveState.status === "saved") {
    return "saved";
  }

  return exists ? "saved" : "idle";
}

function getWeeklySaveStatusLabel(
  saveState: { status: "idle" | "saving" | "saved" | "error"; message: string },
  hasUnsavedChanges: boolean,
  exists: boolean,
  isComplete: boolean
) {
  if (saveState.status === "saving") {
    return "Saving...";
  }

  if (hasUnsavedChanges) {
    return "Unsaved changes";
  }

  if (saveState.status === "error") {
    return saveState.message || "Save failed";
  }

  if (saveState.status === "saved") {
    return isComplete ? "Completed" : "Saved";
  }

  return exists ? (isComplete ? "Completed" : "Saved") : "Not saved yet";
}

function formatReviewSavedTime(updatedAt: WeeklyReview["updatedAt"]) {
  if (!updatedAt) {
    return null;
  }

  if (typeof updatedAt.toDate === "function") {
    return updatedAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return null;
}
