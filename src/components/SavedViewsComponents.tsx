import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { dueDateGroups, energyLevels, priorities, suggestedSavedFilters, taskStatuses } from "../constants";
import {
  applyTaskFilters,
  cleanFilterCriteria,
  getQuerySummary,
  labelDueDateGroup,
} from "../filterUtils";
import type {
  DueDateGroup,
  EnergyLevel,
  FilterCriteria,
  Project,
  SavedFilter,
  SavedFilterFormValues,
  TagCount,
  Task,
  TaskPriority,
  TaskStatus,
} from "../types";
import { getFriendlyError, titleCase } from "../utils";
import { EmptyState, StatusBanner } from "./Common";
import { TagList } from "./TaskBrowseComponents";
import { TaskRow } from "./TaskComponents";

export function SavedViewsPage({
  filters,
  filtersLoading,
  tasks,
  projects,
  tags,
  selectedFilterId,
  onSelectFilter,
  onCreateFilter,
  onCreateSuggestedFilter,
  onEditFilter,
  onDeleteFilter,
  onSelectTag,
  taskActions,
}: {
  filters: SavedFilter[];
  filtersLoading: boolean;
  tasks: Task[];
  projects: Project[];
  tags: TagCount[];
  selectedFilterId: string | null;
  onSelectFilter: (filterId: string | null) => void;
  onCreateFilter: () => void;
  onCreateSuggestedFilter: (values: SavedFilterFormValues) => void;
  onEditFilter: (filter: SavedFilter) => void;
  onDeleteFilter: (filter: SavedFilter) => void;
  onSelectTag: (tag: string) => void;
  taskActions: SavedViewTaskActions;
}) {
  const openCountsByFilter = useMemo(() => {
    return filters.reduce<Record<string, number>>((counts, filter) => {
      counts[filter.id] = applyTaskFilters(tasks, filter.query).filter((task) => task.status !== "done" && task.status !== "archived").length;
      return counts;
    }, {});
  }, [filters, tasks]);
  const selectedFilter = selectedFilterId ? filters.find((filter) => filter.id === selectedFilterId) ?? null : null;
  const selectedTasks = selectedFilter ? applyTaskFilters(tasks, selectedFilter.query) : [];
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  return (
    <section className="saved-views-layout">
      <article className="panel saved-views-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Saved Views</p>
            <h3>Reusable task filters</h3>
          </div>
          <button className="primary-button" type="button" onClick={onCreateFilter}>
            <Plus size={18} />
            New view
          </button>
        </div>

        {filtersLoading ? <EmptyState title="Loading saved views" message="Reading your user-specific Firestore filters." /> : null}
        {!filtersLoading && filters.length === 0 ? (
          <EmptyState title="No saved views yet" message="Create a custom view or start from a suggested filter." />
        ) : null}

        <div className="saved-view-grid">
          {filters.map((filter) => (
            <SavedViewCard
              key={filter.id}
              filter={filter}
              projects={projects}
              openTaskCount={openCountsByFilter[filter.id] ?? 0}
              selected={selectedFilterId === filter.id}
              onSelect={onSelectFilter}
              onEdit={onEditFilter}
              onDelete={onDeleteFilter}
            />
          ))}
        </div>

        <section className="suggested-filter-section" aria-label="Suggested saved views">
          <h4>Suggested filters</h4>
          <div className="suggested-filter-grid">
            {suggestedSavedFilters.map((filter) => (
              <button
                type="button"
                className="suggested-filter-card"
                key={filter.name}
                onClick={() =>
                  onCreateSuggestedFilter({
                    name: filter.name,
                    description: filter.description,
                    color: filter.color,
                    query: filter.query,
                  })
                }
              >
                <span style={{ background: filter.color }} />
                <strong>{filter.name}</strong>
                <small>{getQuerySummary(filter.query, projects)}</small>
              </button>
            ))}
          </div>
        </section>
      </article>

      <aside className="panel saved-view-results">
        {selectedFilter ? (
          <>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Matching tasks</p>
                <h3>{selectedFilter.name}</h3>
              </div>
              <button className="secondary-button" type="button" onClick={() => onSelectFilter(null)}>
                Clear
              </button>
            </div>
            <p className="panel-copy">{getQuerySummary(selectedFilter.query, projects)}</p>
            {selectedTasks.length === 0 ? <EmptyState title="No matching tasks" message="This saved view currently has no matching tasks." /> : null}
            <div className="task-list">
              {selectedTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  project={task.projectId ? projectById.get(task.projectId) ?? null : null}
                  {...taskActions}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Tags</p>
                <h3>Task tags</h3>
              </div>
            </div>
            <TagList tags={tags} onSelectTag={onSelectTag} />
          </>
        )}
      </aside>
    </section>
  );
}

export function SavedViewCard({
  filter,
  projects,
  openTaskCount,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  filter: SavedFilter;
  projects: Project[];
  openTaskCount: number;
  selected: boolean;
  onSelect: (filterId: string) => void;
  onEdit: (filter: SavedFilter) => void;
  onDelete: (filter: SavedFilter) => void;
}) {
  const querySummary = getQuerySummary(filter.query, projects);

  return (
    <article className={`saved-view-card ${selected ? "selected" : ""}`} style={{ "--filter-color": filter.color } as CSSProperties}>
      <div className="saved-view-card-header">
        <button type="button" className="saved-view-title-button" onClick={() => onSelect(filter.id)}>
          <span className="filter-color-dot" aria-hidden="true" />
          <strong>{filter.name}</strong>
        </button>
        <div className="saved-view-actions" aria-label={`Actions for ${filter.name}`}>
          <button type="button" className="icon-button task-icon-button" aria-label={`Edit ${filter.name}`} onClick={() => onEdit(filter)}>
            <Pencil size={16} />
          </button>
          <button type="button" className="icon-button task-icon-button danger" aria-label={`Delete ${filter.name}`} onClick={() => onDelete(filter)}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <button type="button" className="saved-view-card-body" onClick={() => onSelect(filter.id)} aria-label={`Open saved view ${filter.name}`}>
        <span className="saved-view-count-badge">{openTaskCount} open</span>
        <span className="saved-view-query">{querySummary}</span>
        {filter.description ? <span className="saved-view-description">{filter.description}</span> : null}
      </button>
    </article>
  );
}

export function SavedViewForm({
  filter,
  projects,
  tags,
  onClose,
  onSave,
}: {
  filter: SavedFilter | null;
  projects: Project[];
  tags: TagCount[];
  onClose: () => void;
  onSave: (values: SavedFilterFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<SavedFilterFormValues>({
    name: filter?.name ?? "",
    description: filter?.description ?? "",
    color: filter?.color ?? "#2a5f48",
    query: filter?.query ?? {},
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    if (!values.name.trim()) {
      setError("Saved view name is required.");
      setSaving(false);
      return;
    }

    try {
      await onSave({
        ...values,
        name: values.name.trim(),
        description: values.description.trim(),
        query: cleanFilterCriteria(values.query),
      });
    } catch (saveError) {
      setError(getFriendlyError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="saved-view-editor-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{filter ? "Edit saved view" : "Create saved view"}</p>
            <h3 id="saved-view-editor-title">{filter ? filter.name : "New saved view"}</h3>
          </div>
          <button type="button" className="icon-button task-icon-button" aria-label="Close saved view editor" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          <label>
            Name
            <input required value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} />
          </label>

          <label>
            Description
            <textarea value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} />
          </label>

          <label>
            Color
            <input type="color" value={values.color} onChange={(event) => setValues({ ...values, color: event.target.value })} />
          </label>

          <FilterBuilder
            criteria={values.query}
            projects={projects}
            tags={tags}
            onChange={(query) => setValues({ ...values, query })}
          />

          {error ? <StatusBanner tone="error" message={error} /> : null}

          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" disabled={saving} type="submit">
              <Save size={18} />
              {saving ? "Saving..." : "Save view"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function FilterBuilder({
  criteria,
  projects,
  tags,
  onChange,
}: {
  criteria: FilterCriteria;
  projects: Project[];
  tags: TagCount[];
  onChange: (criteria: FilterCriteria) => void;
}) {
  const update = (updates: FilterCriteria) => onChange({ ...criteria, ...updates });

  return (
    <fieldset className="filter-builder">
      <legend>Filter builder</legend>
      <div className="form-grid">
        <label>
          Search text
          <input value={criteria.searchText ?? ""} onChange={(event) => update({ searchText: event.target.value })} />
        </label>

        <label>
          Status
          <select value={criteria.status ?? ""} onChange={(event) => update({ status: (event.target.value || undefined) as TaskStatus | undefined })}>
            <option value="">Any status</option>
            {taskStatuses.map((status) => (
              <option key={status} value={status}>
                {titleCase(status)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Priority
          <select value={criteria.priority ?? ""} onChange={(event) => update({ priority: (event.target.value || undefined) as TaskPriority | undefined })}>
            <option value="">Any priority</option>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {titleCase(priority)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Project
          <select value={criteria.projectId ?? ""} onChange={(event) => update({ projectId: event.target.value || undefined })}>
            <option value="">Any project</option>
            <option value="none">No project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tag
          <select value={criteria.tag ?? ""} onChange={(event) => update({ tag: event.target.value || undefined })}>
            <option value="">Any tag</option>
            {tags.map((tag) => (
              <option key={tag.tag} value={tag.tag}>
                #{tag.tag}
              </option>
            ))}
          </select>
        </label>

        <label>
          Due date group
          <select value={criteria.dueDateGroup ?? ""} onChange={(event) => update({ dueDateGroup: (event.target.value || undefined) as DueDateGroup | undefined })}>
            <option value="">Any due date</option>
            {dueDateGroups.map((group) => (
              <option key={group} value={group}>
                {labelDueDateGroup(group)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Energy level
          <select value={criteria.energyLevel ?? ""} onChange={(event) => update({ energyLevel: (event.target.value || undefined) as EnergyLevel | undefined })}>
            <option value="">Any energy</option>
            {energyLevels.map((energy) => (
              <option key={energy} value={energy}>
                {titleCase(energy)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}

export type SavedViewTaskActions = {
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMarkDone: (task: Task) => void;
  onUndoDone: (task: Task) => void;
  onArchive: (task: Task) => void;
  onMoveToday: (task: Task) => void;
  onMoveUpcoming: (task: Task) => void;
  onFocus?: (task: Task) => void;
};
