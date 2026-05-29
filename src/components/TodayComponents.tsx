import { CalendarClock, Check, CheckCircle2, Clock3, Pencil, Plus, Save, Star, Target, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { energyLevels, moodLevels, timeBlockTypes } from "../constants";
import type {
  DailyPlan,
  DailyReflection,
  EnergyLevel,
  FocusStats,
  InsightMessage,
  MoodLevel,
  Project,
  Task,
  TimeBlock,
  TimeBlockFormValues,
  TimeBlockType,
  TodayStats,
} from "../types";
import { formatMinutes, labelTimeBlockType, sortTimeBlocks, validateTimeBlock } from "../todayUtils";
import { displayWithEmoji } from "../emojiPresets";
import { titleCase } from "../utils";
import { EmptyState, StatusBanner } from "./Common";
import { InsightMessageList } from "./InsightsComponents";
import { QuickCapture } from "./TaskComponents";
import { TagChip } from "./TaskBrowseComponents";
import { RecurrenceSummary, ReminderBadge } from "./ReminderComponents";
import { sortTasksByDueDateTime } from "../recurrenceUtils";

export function TodayPage({
  dateId,
  plan,
  loading,
  tasks,
  todayTasks,
  overdueTasks,
  projects,
  stats,
  focusStats,
  insightMessages,
  onQuickCreate,
  onAddTopTask,
  onRemoveTopTask,
  onSetDeepWork,
  onClearDeepWork,
  onStartFocusBlock,
  onSaveTimeBlock,
  onDeleteTimeBlock,
  onToggleTimeBlock,
  onSaveReflection,
  onEditTask,
  onMarkDone,
  onMoveTask,
  onFocusTask,
}: {
  dateId: string;
  plan: DailyPlan;
  loading: boolean;
  tasks: Task[];
  todayTasks: Task[];
  overdueTasks: Task[];
  projects: Project[];
  stats: TodayStats;
  focusStats: FocusStats;
  insightMessages: InsightMessage[];
  onQuickCreate: (value: string) => Promise<void>;
  onAddTopTask: (taskId: string) => void;
  onRemoveTopTask: (taskId: string) => void;
  onSetDeepWork: (taskId: string) => void;
  onClearDeepWork: () => void;
  onStartFocusBlock: (task: Task) => void;
  onSaveTimeBlock: (blockId: string | null, values: TimeBlockFormValues) => Promise<void>;
  onDeleteTimeBlock: (block: TimeBlock) => void;
  onToggleTimeBlock: (block: TimeBlock) => void;
  onSaveReflection: (reflection: DailyReflection) => Promise<void>;
  onEditTask: (task: Task) => void;
  onMarkDone: (task: Task) => void;
  onMoveTask: (task: Task, status: "inbox" | "upcoming") => void;
  onFocusTask: (task: Task) => void;
}) {
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const deepWorkTask = plan.deepWorkTaskId ? taskById.get(plan.deepWorkTaskId) ?? null : null;
  const candidateTasks = tasks.filter((task) => task.status !== "archived" && task.status !== "done");

  return (
    <section className="today-page">
      <header className="today-hero">
        <div>
          <p className="eyebrow">Today planning</p>
          <h3>{formatDateHeading(dateId)}</h3>
          <p>Choose what matters, reserve focus time, and close the day with a short reflection.</p>
        </div>
        <QuickCapture label="Quick capture for Today" onCreate={onQuickCreate} />
      </header>

      <TodaySummary stats={stats} focusStats={focusStats} />

      {loading ? <EmptyState title="Loading daily plan" message="Reading today's planning document from Firestore." /> : null}

      <section className="today-grid">
        <TopThreePlanner
          plan={plan}
          todayTasks={todayTasks}
          taskById={taskById}
          projectById={projectById}
          onAddTopTask={onAddTopTask}
          onRemoveTopTask={onRemoveTopTask}
        />

        <DeepWorkCard
          task={deepWorkTask}
          candidateTasks={candidateTasks}
          projectById={projectById}
          selectedTaskId={plan.deepWorkTaskId}
          onSetDeepWork={onSetDeepWork}
          onClearDeepWork={onClearDeepWork}
          onStartFocusBlock={onStartFocusBlock}
        />
      </section>

      <section className="today-grid">
        <TodayTaskList
          title="Overdue"
          emptyMessage="No overdue tasks."
          tasks={overdueTasks}
          projectById={projectById}
          onEditTask={onEditTask}
          onMarkDone={onMarkDone}
          onMoveTask={onMoveTask}
          onFocusTask={onFocusTask}
        />
        <TodayTaskList
          title="Today tasks"
          emptyMessage="Move tasks to Today or quick capture one above."
          tasks={todayTasks}
          projectById={projectById}
          onEditTask={onEditTask}
          onMarkDone={onMarkDone}
          onMoveTask={onMoveTask}
          onFocusTask={onFocusTask}
        />
      </section>

      <TimeBlockList
        blocks={plan.timeBlocks}
        tasks={candidateTasks}
        taskById={taskById}
        onSaveTimeBlock={onSaveTimeBlock}
        onDeleteTimeBlock={onDeleteTimeBlock}
        onToggleTimeBlock={onToggleTimeBlock}
      />

      <TodayAnalyticsPanel stats={stats} focusStats={focusStats} plan={plan} recommendation={insightMessages[0] ?? null} />

      <DailyReflectionForm reflection={plan.reflection} onSave={onSaveReflection} />
    </section>
  );
}

export function TodaySummary({ stats, focusStats }: { stats: TodayStats; focusStats: FocusStats }) {
  return (
    <section className="today-summary-grid" aria-label="Today summary">
      <SummaryTile label="Today tasks" value={String(stats.todayTasks)} />
      <SummaryTile label="Overdue" value={String(stats.overdueTasks)} />
      <SummaryTile label="Estimated" value={formatMinutes(stats.totalEstimatedMinutes)} />
      <SummaryTile label="Completed" value={String(stats.completedToday)} />
      <SummaryTile label="Top 3 done" value={`${stats.topCompleted}/3`} />
      <SummaryTile label="Focus" value={formatMinutes(focusStats.totalFocusedMinutes)} />
      <SummaryTile label="Focus sessions" value={String(focusStats.completedSessions)} />
    </section>
  );
}

export function TodayAnalyticsPanel({
  stats,
  focusStats,
  plan,
  recommendation,
}: {
  stats: TodayStats;
  focusStats: FocusStats;
  plan: DailyPlan;
  recommendation: InsightMessage | null;
}) {
  const plannedCount = Math.max(stats.todayTasks, plan.topTaskIds.length);
  const plannedCompletion = plannedCount > 0 ? Math.round((stats.completedToday / plannedCount) * 100) : 0;
  const topThreeText = `${stats.topCompleted}/${Math.max(3, plan.topTaskIds.length || 3)}`;

  return (
    <article className="panel today-panel today-analytics-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Today analytics</p>
          <h3>Planning signal</h3>
        </div>
        <Target size={20} />
      </div>
      <div className="today-analytics-grid">
        <span>
          <strong>{topThreeText}</strong>
          Top 3 complete
        </span>
        <span>
          <strong>{formatMinutes(focusStats.totalFocusedMinutes)}</strong>
          focus today
        </span>
        <span>
          <strong>{stats.completedToday}/{plannedCount}</strong>
          planned vs done
        </span>
        <span>
          <strong>{plannedCompletion}%</strong>
          completion signal
        </span>
      </div>
      <div className="performance-score" aria-label={`Today planned completion ${plannedCompletion}%`}>
        <span style={{ width: `${Math.min(100, plannedCompletion)}%` }} />
      </div>
      {recommendation ? (
        <section className={`insight-card ${recommendation.severity}`}>
          <strong>Today's suggestion: {recommendation.title}</strong>
          <p>{recommendation.message}</p>
        </section>
      ) : (
        <InsightMessageList messages={[]} />
      )}
    </article>
  );
}

export function TopThreePlanner({
  plan,
  todayTasks,
  taskById,
  projectById,
  onAddTopTask,
  onRemoveTopTask,
}: {
  plan: DailyPlan;
  todayTasks: Task[];
  taskById: Map<string, Task>;
  projectById: Map<string, Project>;
  onAddTopTask: (taskId: string) => void;
  onRemoveTopTask: (taskId: string) => void;
}) {
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const selectableTasks = todayTasks.filter((task) => !plan.topTaskIds.includes(task.id) && task.status !== "done");
  const slots = [0, 1, 2];

  function addSelectedTask() {
    if (!selectedTaskId) {
      return;
    }

    onAddTopTask(selectedTaskId);
    setSelectedTaskId("");
  }

  return (
    <article className="panel today-panel top-three-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Top 3</p>
          <h3>Priorities for today</h3>
        </div>
        <Star size={20} />
      </div>

      <div className="top-task-grid">
        {slots.map((slot) => {
          const taskId = plan.topTaskIds[slot];
          const task = taskId ? taskById.get(taskId) ?? null : null;

          if (!taskId) {
            return (
              <div className="top-task-card empty" key={slot}>
                <strong>{slot === 0 ? "Choose a priority" : "What matters most today?"}</strong>
                <span>Pick from today's tasks below.</span>
              </div>
            );
          }

          if (!task) {
            return (
              <div className="top-task-card missing" key={taskId}>
                <strong>Task no longer exists</strong>
                <button className="secondary-button" type="button" onClick={() => onRemoveTopTask(taskId)}>
                  Remove
                </button>
              </div>
            );
          }

          return (
            <TaskPriorityCard key={task.id} task={task} project={task.projectId ? projectById.get(task.projectId) ?? null : null}>
              <button className="secondary-button" type="button" onClick={() => onRemoveTopTask(task.id)}>
                Remove
              </button>
            </TaskPriorityCard>
          );
        })}
      </div>

      <div className="inline-planner-control">
        <label>
          Add today task
          <select value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)} disabled={plan.topTaskIds.length >= 3}>
            <option value="">Choose a task</option>
            {selectableTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {displayWithEmoji(task.title, task.emoji)}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-button" type="button" onClick={addSelectedTask} disabled={!selectedTaskId || plan.topTaskIds.length >= 3}>
          <Plus size={17} />
          Add
        </button>
      </div>
    </article>
  );
}

export function DeepWorkCard({
  task,
  candidateTasks,
  projectById,
  selectedTaskId,
  onSetDeepWork,
  onClearDeepWork,
  onStartFocusBlock,
}: {
  task: Task | null;
  candidateTasks: Task[];
  projectById: Map<string, Project>;
  selectedTaskId: string | null;
  onSetDeepWork: (taskId: string) => void;
  onClearDeepWork: () => void;
  onStartFocusBlock: (task: Task) => void;
}) {
  const [selected, setSelected] = useState(selectedTaskId ?? "");

  useEffect(() => {
    setSelected(selectedTaskId ?? "");
  }, [selectedTaskId]);

  return (
    <article className="panel today-panel deep-work-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Deep Work</p>
          <h3>One task for focused effort</h3>
        </div>
        <Target size={20} />
      </div>

      {task ? (
        <TaskPriorityCard task={task} project={task.projectId ? projectById.get(task.projectId) ?? null : null}>
          <button className="primary-button" type="button" onClick={() => onStartFocusBlock(task)}>
            <Clock3 size={17} />
            Start focus block
          </button>
          <button className="secondary-button" type="button" onClick={onClearDeepWork}>
            Clear
          </button>
        </TaskPriorityCard>
      ) : (
        <EmptyState title="No Deep Work task" message="Choose a Deep Work task first." />
      )}

      <div className="inline-planner-control">
        <label>
          Deep Work task
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Choose a task</option>
            {candidateTasks.map((candidateTask) => (
              <option key={candidateTask.id} value={candidateTask.id}>
                {displayWithEmoji(candidateTask.title, candidateTask.emoji)}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-button" type="button" onClick={() => selected && onSetDeepWork(selected)} disabled={!selected}>
          Set
        </button>
      </div>
    </article>
  );
}

export function TimeBlockList({
  blocks,
  tasks,
  taskById,
  onSaveTimeBlock,
  onDeleteTimeBlock,
  onToggleTimeBlock,
}: {
  blocks: TimeBlock[];
  tasks: Task[];
  taskById: Map<string, Task>;
  onSaveTimeBlock: (blockId: string | null, values: TimeBlockFormValues) => Promise<void>;
  onDeleteTimeBlock: (block: TimeBlock) => void;
  onToggleTimeBlock: (block: TimeBlock) => void;
}) {
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const sortedBlocks = sortTimeBlocks(blocks);

  return (
    <article className="panel today-panel time-block-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Time blocks</p>
          <h3>Plan the shape of the day</h3>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            setEditingBlock(null);
            setFormOpen(true);
          }}
        >
          <Plus size={17} />
          Add block
        </button>
      </div>

      {formOpen ? (
        <TimeBlockForm
          block={editingBlock}
          tasks={tasks}
          onCancel={() => {
            setFormOpen(false);
            setEditingBlock(null);
          }}
          onSave={async (values) => {
            await onSaveTimeBlock(editingBlock?.id ?? null, values);
            setFormOpen(false);
            setEditingBlock(null);
          }}
        />
      ) : null}

      {sortedBlocks.length === 0 ? <EmptyState title="No time blocks yet" message="Create a block for deep work, study, admin, breaks, or personal time." /> : null}

      <div className="time-block-list">
        {sortedBlocks.map((block) => {
          const task = block.taskId ? taskById.get(block.taskId) ?? null : null;
          return (
            <section className={`time-block-card ${block.completed ? "completed" : ""}`} key={block.id}>
              <time>
                {block.startTime} - {block.endTime}
              </time>
              <div>
                <strong>{block.title || (task ? displayWithEmoji(task.title, task.emoji) : "") || "Untitled block"}</strong>
                <span className={`time-block-type ${block.type}`}>{labelTimeBlockType(block.type)}</span>
                {task ? <small>Task: {displayWithEmoji(task.title, task.emoji)}</small> : null}
                {block.notes ? <p>{block.notes}</p> : null}
              </div>
              <div className="time-block-actions">
                <button className="icon-text-button" type="button" onClick={() => onToggleTimeBlock(block)}>
                  <Check size={16} />
                  {block.completed ? "Undo" : "Done"}
                </button>
                <button
                  className="icon-button task-icon-button"
                  type="button"
                  aria-label={`Edit ${block.title}`}
                  onClick={() => {
                    setEditingBlock(block);
                    setFormOpen(true);
                  }}
                >
                  <Pencil size={16} />
                </button>
                <button className="icon-button task-icon-button danger" type="button" aria-label={`Delete ${block.title}`} onClick={() => onDeleteTimeBlock(block)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}

export function TimeBlockForm({
  block,
  tasks,
  onCancel,
  onSave,
}: {
  block: TimeBlock | null;
  tasks: Task[];
  onCancel: () => void;
  onSave: (values: TimeBlockFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<TimeBlockFormValues>({
    taskId: block?.taskId ?? "",
    title: block?.title ?? "",
    startTime: block?.startTime ?? "",
    endTime: block?.endTime ?? "",
    type: block?.type ?? "other",
    notes: block?.notes ?? "",
    completed: block?.completed ?? false,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateTimeBlock(values);
    setErrors(validationErrors);
    if (validationErrors.length > 0) {
      return;
    }

    setSaving(true);
    await onSave(values);
    setSaving(false);
  }

  return (
    <form className="time-block-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          Task
          <select value={values.taskId} onChange={(event) => setValues({ ...values, taskId: event.target.value })}>
            <option value="">No task</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {displayWithEmoji(task.title, task.emoji)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Title
          <input value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} placeholder="Freeform block title" />
        </label>
        <label>
          Start
          <input type="time" value={values.startTime} onChange={(event) => setValues({ ...values, startTime: event.target.value })} />
        </label>
        <label>
          End
          <input type="time" value={values.endTime} onChange={(event) => setValues({ ...values, endTime: event.target.value })} />
        </label>
        <label>
          Type
          <select value={values.type} onChange={(event) => setValues({ ...values, type: event.target.value as TimeBlockType })}>
            {timeBlockTypes.map((type) => (
              <option key={type} value={type}>
                {labelTimeBlockType(type)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Notes
        <textarea value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} />
      </label>
      {errors.length > 0 ? <StatusBanner tone="error" message={errors.join(" ")} /> : null}
      <div className="modal-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>
          <X size={17} />
          Cancel
        </button>
        <button className="primary-button" type="submit" disabled={saving}>
          <Save size={17} />
          {saving ? "Saving..." : "Save block"}
        </button>
      </div>
    </form>
  );
}

export function DailyReflectionForm({
  reflection,
  onSave,
}: {
  reflection: DailyReflection;
  onSave: (reflection: DailyReflection) => Promise<void>;
}) {
  const [values, setValues] = useState<DailyReflection>(reflection);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValues(reflection);
  }, [reflection]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    await onSave(values);
    setSaving(false);
    setSaved(true);
  }

  return (
    <article className="panel today-panel reflection-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Daily reflection</p>
          <h3>Close the loop</h3>
        </div>
      </div>
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          What went well?
          <textarea value={values.wentWell} onChange={(event) => setValues({ ...values, wentWell: event.target.value })} />
        </label>
        <label>
          What distracted me?
          <textarea value={values.distractions} onChange={(event) => setValues({ ...values, distractions: event.target.value })} />
        </label>
        <label>
          What will I improve tomorrow?
          <textarea value={values.improveTomorrow} onChange={(event) => setValues({ ...values, improveTomorrow: event.target.value })} />
        </label>
        <div className="form-grid">
          <label>
            Energy
            <select value={values.energyLevel ?? ""} onChange={(event) => setValues({ ...values, energyLevel: (event.target.value || null) as EnergyLevel | null })}>
              <option value="">Choose energy</option>
              {energyLevels.map((level) => (
                <option key={level} value={level}>
                  {titleCase(level)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mood
            <select value={values.mood ?? ""} onChange={(event) => setValues({ ...values, mood: (event.target.value || null) as MoodLevel | null })}>
              <option value="">Choose mood</option>
              {moodLevels.map((mood) => (
                <option key={mood} value={mood}>
                  {titleCase(mood)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {saved ? <StatusBanner tone="success" message="Reflection saved." /> : null}
        <button className="primary-button" type="submit" disabled={saving}>
          <Save size={17} />
          {saving ? "Saving..." : "Save reflection"}
        </button>
      </form>
    </article>
  );
}

export function DurationBadge({ minutes }: { minutes: number }) {
  return <span className="duration-badge">{formatMinutes(minutes)}</span>;
}

function TodayTaskList({
  title,
  emptyMessage,
  tasks,
  projectById,
  onEditTask,
  onMarkDone,
  onMoveTask,
  onFocusTask,
}: {
  title: string;
  emptyMessage: string;
  tasks: Task[];
  projectById: Map<string, Project>;
  onEditTask: (task: Task) => void;
  onMarkDone: (task: Task) => void;
  onMoveTask: (task: Task, status: "inbox" | "upcoming") => void;
  onFocusTask: (task: Task) => void;
}) {
  return (
    <article className="panel today-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>{tasks.length} task{tasks.length === 1 ? "" : "s"}</h3>
        </div>
      </div>
      {tasks.length === 0 ? <EmptyState title={emptyMessage} message="Use task actions or quick capture to adjust today's list." /> : null}
      <div className="today-task-list">
        {sortTasksByDueDateTime(tasks).map((task) => (
          <TaskPriorityCard key={task.id} task={task} project={task.projectId ? projectById.get(task.projectId) ?? null : null}>
            <button className="icon-text-button" type="button" onClick={() => onMarkDone(task)}>
              <Check size={16} />
              Done
            </button>
            <button className="icon-text-button" type="button" onClick={() => onMoveTask(task, "inbox")}>
              Inbox
            </button>
            <button className="icon-text-button" type="button" onClick={() => onMoveTask(task, "upcoming")}>
              Upcoming
            </button>
            <button className="icon-text-button subtle-focus-button" type="button" onClick={() => onFocusTask(task)}>
              <Clock3 size={16} />
              Focus
            </button>
            <button className="icon-button task-icon-button" type="button" aria-label={`Edit ${task.title}`} onClick={() => onEditTask(task)}>
              <Pencil size={16} />
            </button>
          </TaskPriorityCard>
        ))}
      </div>
    </article>
  );
}

function TaskPriorityCard({
  task,
  project,
  children,
}: {
  task: Task;
  project: Project | null;
  children?: ReactNode;
}) {
  return (
    <section className="planner-task-card">
      <div className="planner-task-main">
        <strong>{displayWithEmoji(task.title, task.emoji)}</strong>
        <div className="task-meta">
          {project ? (
            <em className="project-badge" style={{ "--project-color": project.color } as CSSProperties}>
              {displayWithEmoji(project.name, project.emoji)}
            </em>
          ) : null}
          <em className={`priority ${task.priority}`}>{task.priority}</em>
          {task.dueDate ? <span>Due {task.dueDate}{task.dueTime ? ` at ${task.dueTime}` : ""}</span> : null}
          <DurationBadge minutes={Number(task.estimatedMinutes || 0)} />
          <RecurrenceSummary task={task} />
          <ReminderBadge task={task} />
          {task.tags.map((tag) => (
            <TagChip key={tag} tag={tag} />
          ))}
        </div>
      </div>
      {children ? <div className="planner-task-actions">{children}</div> : null}
    </section>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <article className="summary-tile">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function formatDateHeading(dateId: string) {
  const [year, month, day] = dateId.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date);
}
