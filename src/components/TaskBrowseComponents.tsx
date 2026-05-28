import { Search, Tag } from "lucide-react";
import { dueDateGroups, energyLevels, priorities, taskStatuses } from "../constants";
import type { DueDateGroup, EnergyLevel, FilterCriteria, Project, TagCount, TaskPriority, TaskStatus } from "../types";
import { labelDueDateGroup } from "../filterUtils";
import { titleCase } from "../utils";
import { EmptyState } from "./Common";

export function TaskFilters({
  criteria,
  projects,
  tags,
  onChange,
  onClear,
}: {
  criteria: FilterCriteria;
  projects: Project[];
  tags: TagCount[];
  onChange: (criteria: FilterCriteria) => void;
  onClear: () => void;
}) {
  const update = (updates: FilterCriteria) => onChange({ ...criteria, ...updates });

  return (
    <section className="task-filter-panel" aria-label="Task filters">
      <TaskSearch value={criteria.searchText ?? ""} onChange={(searchText) => update({ searchText })} />

      <div className="task-filter-controls">
        <label className="compact-select">
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

        <label className="compact-select">
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

        <label className="compact-select">
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

        <label className="compact-select">
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

        <label className="compact-select">
          Due
          <select value={criteria.dueDateGroup ?? ""} onChange={(event) => update({ dueDateGroup: (event.target.value || undefined) as DueDateGroup | undefined })}>
            <option value="">Any due date</option>
            {dueDateGroups.map((group) => (
              <option key={group} value={group}>
                {labelDueDateGroup(group)}
              </option>
            ))}
          </select>
        </label>

        <label className="compact-select">
          Energy
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

      <button className="secondary-button filter-clear-button" type="button" onClick={onClear}>
        Clear
      </button>
    </section>
  );
}

export function TaskSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="search-field task-search">
      <Search size={16} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search tasks" />
    </label>
  );
}

export function TagChip({ tag, onClick }: { tag: string; onClick?: (tag: string) => void }) {
  if (onClick) {
    return (
      <button className="tag-chip" type="button" onClick={() => onClick(tag)}>
        <Tag size={13} />
        {tag}
      </button>
    );
  }

  return (
    <span className="tag-chip">
      <Tag size={13} />
      {tag}
    </span>
  );
}

export function TagList({
  tags,
  selectedTag,
  onSelectTag,
}: {
  tags: TagCount[];
  selectedTag?: string;
  onSelectTag: (tag: string) => void;
}) {
  return (
    <section className="tag-list-panel" aria-label="Tags">
      {tags.length === 0 ? <EmptyState title="No tags yet" message="Add #tags through quick capture or the task editor." /> : null}
      <div className="tag-list">
        {tags.map((tag) => (
          <button
            className={`tag-row ${selectedTag === tag.tag ? "selected" : ""}`}
            type="button"
            key={tag.tag}
            onClick={() => onSelectTag(tag.tag)}
          >
            <span>
              <Tag size={16} />
              <strong>#{tag.tag}</strong>
            </span>
            <small>{tag.openTasks} open</small>
            <small>{tag.completedTasks} done</small>
          </button>
        ))}
      </div>
    </section>
  );
}
