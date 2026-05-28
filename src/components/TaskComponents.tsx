import { Archive, CalendarClock, Check, CheckCircle2, Clock3, Pencil, Plus, Save, Trash2, Undo2, X } from "lucide-react";
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { energyLevels, priorities, taskStatuses } from "../constants";
import type { EnergyLevel, FilterCriteria, Project, TagCount, Task, TaskFormValues, TaskPriority, TaskStatus } from "../types";
import { getFriendlyError, titleCase } from "../utils";
import { EmptyState, StatusBanner } from "./Common";
import { normalizeTags } from "../filterUtils";
import { TagChip, TaskFilters } from "./TaskBrowseComponents";

export function QuickCapture({
  label,
  onCreate,
}: {
  label: string;
  onCreate: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await onCreate(value);
      setValue("");
    } catch (quickError) {
      setError(getFriendlyError(quickError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="quick-add" onSubmit={handleSubmit}>
      <input
        aria-label={label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Capture with #tag, !high, +Project"
      />
      <button type="submit" aria-label={label} disabled={submitting}>
        <Plus size={18} />
      </button>
      {error ? <span className="inline-error">{error}</span> : null}
    </form>
  );
}

export function TaskSection({
  loading,
  page,
  tasks,
  projects,
  tags,
  filterCriteria,
  onFilterChange,
  onClearFilters,
  onSelectTag,
  onEdit,
  onDelete,
  onMarkDone,
  onUndoDone,
  onArchive,
  onMoveToday,
  onMoveUpcoming,
  onFocus,
}: {
  loading: boolean;
  page: string;
  tasks: Task[];
  projects: Project[];
  tags: TagCount[];
  filterCriteria: FilterCriteria;
  onFilterChange: (criteria: FilterCriteria) => void;
  onClearFilters: () => void;
  onSelectTag: (tag: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMarkDone: (task: Task) => void;
  onUndoDone: (task: Task) => void;
  onArchive: (task: Task) => void;
  onMoveToday: (task: Task) => void;
  onMoveUpcoming: (task: Task) => void;
  onFocus?: (task: Task) => void;
}) {
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const title = page === "settings" ? "Archived tasks" : page === "dashboard" ? "Recent tasks" : `${titleCase(page)} tasks`;
  const emptyState = getTaskEmptyState(page, filterCriteria);

  return (
    <article className="panel task-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>{loading ? "Syncing with Firestore" : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}</h3>
        </div>
      </div>

      <TaskFilters criteria={filterCriteria} projects={projects} tags={tags} onChange={onFilterChange} onClear={onClearFilters} />

      {loading ? <EmptyState title="Loading tasks" message="Reading your user-specific Firestore task collection." /> : null}
      {!loading && tasks.length === 0 ? <EmptyState title={emptyState.title} message={emptyState.message} /> : null}

      <div className="task-list">
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            project={task.projectId ? projectById.get(task.projectId) ?? null : null}
            onTagClick={onSelectTag}
            onEdit={onEdit}
            onDelete={onDelete}
            onMarkDone={onMarkDone}
            onUndoDone={onUndoDone}
            onArchive={onArchive}
            onMoveToday={onMoveToday}
            onMoveUpcoming={onMoveUpcoming}
            onFocus={onFocus}
          />
        ))}
      </div>
    </article>
  );
}

export function TaskRow({
  task,
  project,
  onEdit,
  onDelete,
  onMarkDone,
  onUndoDone,
  onArchive,
  onMoveToday,
  onMoveUpcoming,
  onFocus,
  onTagClick,
}: {
  task: Task;
  project: Project | null;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMarkDone: (task: Task) => void;
  onUndoDone: (task: Task) => void;
  onArchive: (task: Task) => void;
  onMoveToday: (task: Task) => void;
  onMoveUpcoming: (task: Task) => void;
  onFocus?: (task: Task) => void;
  onTagClick?: (tag: string) => void;
}) {
  return (
    <section className={`task-row ${task.status === "done" ? "is-done" : ""}`}>
      <header className="task-card-header">
        <div className="task-title-line">
          <strong>{task.title}</strong>
        </div>

        <div className="task-primary-actions" aria-label={`Primary actions for ${task.title}`}>
          {task.status === "done" ? (
            <button type="button" className="icon-text-button" onClick={() => onUndoDone(task)}>
              <Undo2 size={16} />
              Undo
            </button>
          ) : (
            <button type="button" className="icon-text-button" onClick={() => onMarkDone(task)}>
              <Check size={16} />
              Done
            </button>
          )}
          <button type="button" className="icon-button task-icon-button" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}>
            <Pencil size={16} />
          </button>
          <button type="button" className="icon-button task-icon-button danger" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)}>
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      <div className="task-main">
        <div className="task-meta">
          <em className={`priority ${task.priority}`}>{task.priority}</em>
          <em className={`status-pill ${task.status}`}>{task.status}</em>
          {project ? (
            <em className="project-badge" style={{ "--project-color": project.color } as CSSProperties}>
              {project.name}
            </em>
          ) : null}
          {task.dueDate ? <span>Due {task.dueDate}</span> : null}
          <span>{task.estimatedMinutes} min</span>
          <span>{titleCase(task.energyLevel)} energy</span>
          {task.tags.map((tag) => (
            <TagChip key={tag} tag={tag} onClick={onTagClick} />
          ))}
        </div>
        {task.description ? <p>{task.description}</p> : null}
        {task.notes ? <small className="task-notes">{task.notes}</small> : null}
      </div>

      <div className="task-actions" aria-label={`Secondary actions for ${task.title}`}>
        {task.status !== "today" ? (
          <button type="button" className="icon-text-button" onClick={() => onMoveToday(task)}>
            <CheckCircle2 size={16} />
            Today
          </button>
        ) : null}

        {task.status !== "upcoming" ? (
          <button type="button" className="icon-text-button" onClick={() => onMoveUpcoming(task)}>
            <CalendarClock size={16} />
            Upcoming
          </button>
        ) : null}

        {task.status !== "archived" ? (
          <button type="button" className="icon-text-button" onClick={() => onArchive(task)}>
            <Archive size={16} />
            Archive
          </button>
        ) : null}

        {onFocus && task.status !== "done" && task.status !== "archived" ? (
          <button type="button" className="icon-text-button subtle-focus-button" onClick={() => onFocus(task)}>
            <Clock3 size={16} />
            Focus
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function TaskEditor({
  task,
  projects,
  defaultStatus,
  defaultProjectId,
  onClose,
  onSave,
}: {
  task: Task | null;
  projects: Project[];
  defaultStatus: TaskStatus;
  defaultProjectId: string | null;
  onClose: () => void;
  onSave: (values: TaskFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<TaskFormValues>(() => taskToFormValues(task, defaultStatus, defaultProjectId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onSave(values);
    } catch (saveError) {
      setError(getFriendlyError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="task-editor-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{task ? "Edit task" : "Create task"}</p>
            <h3 id="task-editor-title">{task ? task.title : "New task"}</h3>
          </div>
          <button type="button" className="icon-button task-icon-button" aria-label="Close editor" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          <label>
            Title
            <input required value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} />
          </label>

          <label>
            Description
            <textarea value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} />
          </label>

          <div className="form-grid">
            <label>
              Status
              <select value={values.status} onChange={(event) => setValues({ ...values, status: event.target.value as TaskStatus })}>
                {taskStatuses.map((status) => (
                  <option key={status} value={status}>
                    {titleCase(status)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Priority
              <select value={values.priority} onChange={(event) => setValues({ ...values, priority: event.target.value as TaskPriority })}>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {titleCase(priority)}
                  </option>
                ))}
              </select>
            </label>

            <ProjectSelector
              projects={projects}
              currentProjectId={task?.projectId ?? defaultProjectId}
              value={values.projectId}
              onChange={(projectId) => setValues({ ...values, projectId })}
            />

            <label>
              Due date
              <input type="date" value={values.dueDate} onChange={(event) => setValues({ ...values, dueDate: event.target.value })} />
            </label>

            <label>
              Estimate
              <input
                min="0"
                type="number"
                value={values.estimatedMinutes}
                onChange={(event) => setValues({ ...values, estimatedMinutes: event.target.value })}
              />
            </label>

            <label>
              Energy
              <select
                value={values.energyLevel}
                onChange={(event) => setValues({ ...values, energyLevel: event.target.value as EnergyLevel })}
              >
                {energyLevels.map((energy) => (
                  <option key={energy} value={energy}>
                    {titleCase(energy)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tags
              <input
                value={values.tags}
                onChange={(event) => setValues({ ...values, tags: normalizeTags(event.target.value).join(", ") })}
                placeholder="work, health"
              />
            </label>
          </div>

          <label>
            Notes
            <textarea value={values.notes} onChange={(event) => setValues({ ...values, notes: event.target.value })} />
          </label>

          {error ? <StatusBanner tone="error" message={error} /> : null}

          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" disabled={saving} type="submit">
              <Save size={18} />
              {saving ? "Saving..." : "Save task"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function ProjectSelector({
  projects,
  currentProjectId,
  value,
  onChange,
}: {
  projects: Project[];
  currentProjectId?: string | null;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectableProjects = projects.filter((project) => project.status === "active" || project.status === "paused");
  const currentProject =
    currentProjectId && !selectableProjects.some((project) => project.id === currentProjectId)
      ? projects.find((project) => project.id === currentProjectId)
      : null;

  return (
    <label>
      Project
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">No project</option>
        {selectableProjects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
        {currentProject ? (
          <option value={currentProject.id}>
            {currentProject.name} ({currentProject.status})
          </option>
        ) : null}
      </select>
    </label>
  );
}

function taskToFormValues(task: Task | null, defaultStatus: TaskStatus, defaultProjectId: string | null): TaskFormValues {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? defaultStatus,
    priority: task?.priority ?? "medium",
    dueDate: task?.dueDate ?? "",
    tags: task?.tags.join(", ") ?? "",
    estimatedMinutes: String(task?.estimatedMinutes ?? 25),
    energyLevel: task?.energyLevel ?? "medium",
    notes: task?.notes ?? "",
    projectId: task?.projectId ?? defaultProjectId ?? "",
  };
}

function getTaskEmptyState(page: string, criteria: FilterCriteria) {
  if (hasActiveFilterCriteria(criteria)) {
    return {
      title: "No matching tasks",
      message: "Clear filters or adjust the search to see more tasks.",
    };
  }

  switch (page) {
    case "dashboard":
      return {
        title: "No matching tasks",
        message: "Create a task from quick capture or attach a task to a project.",
      };
    case "inbox":
      return {
        title: "No inbox tasks yet",
        message: "Capture a task to get started.",
      };
    case "today":
      return {
        title: "No matching tasks",
        message: "Move a task to Today when it is ready for action.",
      };
    case "upcoming":
      return {
        title: "No matching tasks",
        message: "Move a task to Upcoming when it needs future attention.",
      };
    case "settings":
      return {
        title: "No matching tasks",
        message: "Archived tasks will appear here.",
      };
    default:
      return {
        title: "No matching tasks",
        message: "No tasks match the current view.",
      };
  }
}

function hasActiveFilterCriteria(criteria: FilterCriteria) {
  return Object.values(criteria).some((value) => Boolean(value));
}
