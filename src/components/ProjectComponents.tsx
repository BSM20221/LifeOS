import { Archive, CheckCircle2, FolderKanban, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { projectAreas, projectStatuses } from "../constants";
import type { Project, ProjectArea, ProjectFormValues, ProjectStats, ProjectStatus, Task } from "../types";
import { formatProjectDate, getFriendlyError, titleCase } from "../utils";
import { EmptyState, ProgressBar, StatusBanner } from "./Common";
import { EmojiPicker } from "./EmojiPicker";
import { displayWithEmoji } from "../emojiPresets";

type ProjectStatsMap = Record<string, ProjectStats>;

export function ProjectsPage({
  projects,
  tasks,
  statsByProject,
  loading,
  selectedProjectId,
  creatingStarterProjects,
  onSelectProject,
  onCreateProject,
  onCreateStarterProjects,
  onEditProject,
  onAddTask,
  onArchiveProject,
  onUnarchiveProject,
  onCompleteProject,
  onReactivateProject,
  onDeleteProject,
}: {
  projects: Project[];
  tasks: Task[];
  statsByProject: ProjectStatsMap;
  loading: boolean;
  selectedProjectId: string | null;
  creatingStarterProjects: boolean;
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: () => void;
  onCreateStarterProjects: () => void;
  onEditProject: (project: Project) => void;
  onAddTask: (project: Project) => void;
  onArchiveProject: (project: Project) => void;
  onUnarchiveProject: (project: Project) => void;
  onCompleteProject: (project: Project) => void;
  onReactivateProject: (project: Project) => void;
  onDeleteProject: (project: Project) => void;
}) {
  const selectedProject = selectedProjectId ? projects.find((project) => project.id === selectedProjectId) ?? null : null;

  return (
    <section className="projects-layout">
      <article className="panel projects-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Projects</p>
            <h3>Organize tasks by outcome</h3>
          </div>
          <button className="primary-button" type="button" onClick={onCreateProject}>
            <Plus size={18} />
            New project
          </button>
        </div>

        {loading ? <EmptyState title="Loading projects" message="Reading your user-specific Firestore project collection." /> : null}

        {!loading && projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            message="Create your first project or start with the Phase 2 starter set."
            action={
              <button className="secondary-button" type="button" disabled={creatingStarterProjects} onClick={onCreateStarterProjects}>
                <FolderKanban size={17} />
                {creatingStarterProjects ? "Creating..." : "Create starter projects"}
              </button>
            }
          />
        ) : null}

        {projects.length > 0 ? (
          <ProjectList
            projects={projects}
            statsByProject={statsByProject}
            selectedProjectId={selectedProjectId}
            onSelectProject={onSelectProject}
          />
        ) : null}
      </article>

      <ProjectDetail
        project={selectedProject}
        tasks={selectedProject ? tasks.filter((task) => task.projectId === selectedProject.id) : []}
        stats={selectedProject ? statsByProject[selectedProject.id] : undefined}
        onClose={() => onSelectProject(null)}
        onEdit={onEditProject}
        onAddTask={onAddTask}
        onArchive={onArchiveProject}
        onUnarchive={onUnarchiveProject}
        onComplete={onCompleteProject}
        onReactivate={onReactivateProject}
        onDelete={onDeleteProject}
      />
    </section>
  );
}

export function ProjectList({
  projects,
  statsByProject,
  selectedProjectId,
  onSelectProject,
}: {
  projects: Project[];
  statsByProject: ProjectStatsMap;
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | ProjectStatus>("all");
  const [areaFilter, setAreaFilter] = useState<"all" | ProjectArea>("all");
  const [search, setSearch] = useState("");

  const filteredProjects = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesStatus = statusFilter === "all" || project.status === statusFilter;
      const matchesArea = areaFilter === "all" || project.area === areaFilter;
      const matchesSearch = !normalizedSearch || project.name.toLowerCase().includes(normalizedSearch);
      return matchesStatus && matchesArea && matchesSearch;
    });
  }, [areaFilter, projects, search, statusFilter]);

  return (
    <div className="project-list-wrap">
      <div className="project-filters">
        <label className="search-field">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" />
        </label>

        <label className="compact-select">
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | ProjectStatus)}>
            <option value="all">All</option>
            {projectStatuses.map((status) => (
              <option key={status} value={status}>
                {titleCase(status)}
              </option>
            ))}
          </select>
        </label>

        <label className="compact-select">
          Area
          <select value={areaFilter} onChange={(event) => setAreaFilter(event.target.value as "all" | ProjectArea)}>
            <option value="all">All areas</option>
            {projectAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredProjects.length === 0 ? <EmptyState title="No matching projects" message="Adjust the status, area, or search filter." /> : null}

      {projectStatuses.map((status) => {
        const sectionProjects = filteredProjects.filter((project) => project.status === status);
        if (sectionProjects.length === 0) {
          return null;
        }

        const section = (
          <div className="project-grid">
            {sectionProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                stats={statsByProject[project.id]}
                selected={selectedProjectId === project.id}
                onSelect={onSelectProject}
              />
            ))}
          </div>
        );

        return status === "archived" ? (
          <details className="project-section" key={status} open={statusFilter === "archived"}>
            <summary>{titleCase(status)} projects ({sectionProjects.length})</summary>
            {section}
          </details>
        ) : (
          <section className="project-section" key={status} aria-label={`${status} projects`}>
            <h4>{titleCase(status)} projects</h4>
            {section}
          </section>
        );
      })}
    </div>
  );
}

export function ProjectCard({
  project,
  stats,
  selected,
  onSelect,
}: {
  project: Project;
  stats?: ProjectStats;
  selected: boolean;
  onSelect: (projectId: string) => void;
}) {
  const safeStats = stats ?? { openTasks: 0, completedTasks: 0, totalTasks: 0, progress: 0 };

  return (
    <button
      type="button"
      className={`project-card ${selected ? "selected" : ""}`}
      onClick={() => onSelect(project.id)}
      style={{ "--project-color": project.color } as CSSProperties}
    >
      <span className="project-stripe" />
      <span className="project-card-top">
        <strong>{displayWithEmoji(project.name, project.emoji)}</strong>
        <em className={`status-pill ${project.status}`}>{project.status}</em>
      </span>
      {project.description ? <span className="project-card-description">{project.description}</span> : null}
      <span className="project-card-meta">
        <em>{project.area}</em>
        <span>{safeStats.openTasks} open</span>
        <span>{safeStats.completedTasks} done</span>
      </span>
      <ProgressBar value={safeStats.progress} label={`${project.name} progress`} />
      <small>Updated {formatProjectDate(project.updatedAt)}</small>
    </button>
  );
}

export function ProjectDetail({
  project,
  tasks,
  stats,
  onClose,
  onEdit,
  onAddTask,
  onArchive,
  onUnarchive,
  onComplete,
  onReactivate,
  onDelete,
}: {
  project: Project | null;
  tasks: Task[];
  stats?: ProjectStats;
  onClose: () => void;
  onEdit: (project: Project) => void;
  onAddTask: (project: Project) => void;
  onArchive: (project: Project) => void;
  onUnarchive: (project: Project) => void;
  onComplete: (project: Project) => void;
  onReactivate: (project: Project) => void;
  onDelete: (project: Project) => void;
}) {
  if (!project) {
    return (
      <aside className="panel project-detail-panel">
        <EmptyState title="Select a project" message="Open a project card to view progress, tasks, and project actions." />
      </aside>
    );
  }

  const safeStats = stats ?? { openTasks: 0, completedTasks: 0, totalTasks: 0, progress: 0 };
  const openTasks = tasks.filter((task) => task.status !== "done" && task.status !== "archived");
  const completedTasks = tasks.filter((task) => task.status === "done");

  return (
    <aside className="panel project-detail-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Project detail</p>
          <h3>{displayWithEmoji(project.name, project.emoji)}</h3>
        </div>
        <button type="button" className="icon-button task-icon-button" aria-label="Close project detail" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="project-detail-header" style={{ "--project-color": project.color } as CSSProperties}>
        <span className="project-color-dot" />
        <em className="area-pill">{project.area}</em>
        <em className={`status-pill ${project.status}`}>{project.status}</em>
      </div>

      {project.description ? <p className="panel-copy">{project.description}</p> : null}
      <ProgressBar value={safeStats.progress} label={`${project.name} progress`} />

      <div className="project-detail-stats">
        <span>
          <strong>{safeStats.openTasks}</strong>
          Open tasks
        </span>
        <span>
          <strong>{safeStats.completedTasks}</strong>
          Completed
        </span>
      </div>

      <div className="project-actions">
        <button className="primary-button" type="button" onClick={() => onAddTask(project)}>
          <Plus size={17} />
          Add task
        </button>
        <button className="secondary-button" type="button" onClick={() => onEdit(project)}>
          <Pencil size={17} />
          Edit
        </button>
        {project.status === "archived" ? (
          <button className="secondary-button" type="button" onClick={() => onUnarchive(project)}>
            <RotateCcw size={17} />
            Unarchive
          </button>
        ) : (
          <button className="secondary-button" type="button" onClick={() => onArchive(project)}>
            <Archive size={17} />
            Archive
          </button>
        )}
        {project.status === "completed" ? (
          <button className="secondary-button" type="button" onClick={() => onReactivate(project)}>
            <RotateCcw size={17} />
            Reactivate
          </button>
        ) : (
          <button className="secondary-button" type="button" onClick={() => onComplete(project)}>
            <CheckCircle2 size={17} />
            Complete
          </button>
        )}
        <button className="secondary-button danger-button" type="button" onClick={() => onDelete(project)}>
          <Trash2 size={17} />
          Delete
        </button>
      </div>

      <ProjectTaskList title="Open tasks" tasks={openTasks} />
      <ProjectTaskList title="Completed tasks" tasks={completedTasks} />
    </aside>
  );
}

export function ProjectForm({
  project,
  onClose,
  onSave,
}: {
  project: Project | null;
  onClose: () => void;
  onSave: (values: ProjectFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<ProjectFormValues>({
    name: project?.name ?? "",
    description: project?.description ?? "",
    color: project?.color ?? "#2a5f48",
    status: project?.status ?? "active",
    area: project?.area ?? "Study",
    emoji: project?.emoji ?? "",
    icon: project?.icon ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    if (!values.name.trim()) {
      setError("Project name is required.");
      setSaving(false);
      return;
    }

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
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="project-editor-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{project ? "Edit project" : "Create project"}</p>
            <h3 id="project-editor-title">{project ? project.name : "New project"}</h3>
          </div>
          <button type="button" className="icon-button task-icon-button" aria-label="Close project editor" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          <label>
            Project name
            <input required value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} />
          </label>

          <label>
            Description
            <textarea value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} />
          </label>

          <div className="form-grid">
            <EmojiPicker label="Project emoji" value={values.emoji} onChange={(emoji) => setValues({ ...values, emoji })} />

            <label>
              Area
              <select value={values.area} onChange={(event) => setValues({ ...values, area: event.target.value as ProjectArea })}>
                {projectAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Status
              <select value={values.status} onChange={(event) => setValues({ ...values, status: event.target.value as ProjectStatus })}>
                {projectStatuses.map((status) => (
                  <option key={status} value={status}>
                    {titleCase(status)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Color
              <input type="color" value={values.color} onChange={(event) => setValues({ ...values, color: event.target.value })} />
            </label>
          </div>

          {error ? <StatusBanner tone="error" message={error} /> : null}

          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? "Saving..." : "Save project"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ProjectTaskList({ title, tasks }: { title: string; tasks: Task[] }) {
  return (
    <section className="project-task-list" aria-label={title}>
      <h4>{title}</h4>
      {tasks.length === 0 ? <span className="muted-line">No tasks in this group.</span> : null}
      {tasks.map((task) => (
        <div className="project-task-mini" key={task.id}>
          <strong>{displayWithEmoji(task.title, task.emoji)}</strong>
          <span>{task.status}</span>
        </div>
      ))}
    </section>
  );
}
