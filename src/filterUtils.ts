import { dueDateGroups, energyLevels, priorities, taskStatuses } from "./constants";
import type { DueDateGroup, FilterCriteria, Project, SavedFilter, TagCount, Task } from "./types";

export function normalizeTags(input: string | string[]) {
  const rawTags = Array.isArray(input) ? input : input.split(",");

  return Array.from(
    new Set(
      rawTags
        .flatMap((tag) => tag.split(/\s+/))
        .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
        .filter(Boolean)
    )
  );
}

export function applyTaskFilters(tasks: Task[], criteria: FilterCriteria) {
  const searchText = criteria.searchText?.trim().toLowerCase() ?? "";
  const tag = criteria.tag?.trim().toLowerCase() ?? "";

  return tasks.filter((task) => {
    if (criteria.status && task.status !== criteria.status) {
      return false;
    }

    if (criteria.priority && task.priority !== criteria.priority) {
      return false;
    }

    if (criteria.projectId === "none" && task.projectId) {
      return false;
    }

    if (criteria.projectId && criteria.projectId !== "none" && task.projectId !== criteria.projectId) {
      return false;
    }

    if (tag && !task.tags.includes(tag)) {
      return false;
    }

    if (criteria.energyLevel && task.energyLevel !== criteria.energyLevel) {
      return false;
    }

    if (criteria.dueDateGroup && getDueDateGroup(task.dueDate) !== criteria.dueDateGroup) {
      return false;
    }

    if (searchText) {
      const searchable = [task.title, task.description, task.notes, task.tags.join(" ")].join(" ").toLowerCase();
      if (!searchable.includes(searchText)) {
        return false;
      }
    }

    return true;
  });
}

export function getDueDateGroup(dueDate: string): DueDateGroup {
  if (!dueDate) {
    return "no-due-date";
  }

  const due = parseISODate(dueDate);
  if (!due) {
    return "later";
  }

  const today = startOfLocalDay(new Date());
  const tomorrow = addDays(today, 1);
  const weekLimit = addDays(today, 7);

  if (due < today) {
    return "overdue";
  }

  if (sameDay(due, today)) {
    return "today";
  }

  if (sameDay(due, tomorrow)) {
    return "tomorrow";
  }

  if (due <= weekLimit) {
    return "this-week";
  }

  return "later";
}

export function getTaskCountsByTag(tasks: Task[]): TagCount[] {
  const counts = new Map<string, TagCount>();

  tasks.forEach((task) => {
    task.tags.forEach((tag) => {
      const normalizedTag = tag.trim().toLowerCase();
      if (!normalizedTag) {
        return;
      }

      const current = counts.get(normalizedTag) ?? {
        tag: normalizedTag,
        openTasks: 0,
        completedTasks: 0,
        totalTasks: 0,
      };

      if (task.status === "done") {
        current.completedTasks += 1;
      } else if (task.status !== "archived") {
        current.openTasks += 1;
      }

      current.totalTasks += 1;
      counts.set(normalizedTag, current);
    });
  });

  return Array.from(counts.values()).sort((left, right) => right.openTasks - left.openTasks || left.tag.localeCompare(right.tag));
}

export function getTaskCountsByFilter(tasks: Task[], filters: SavedFilter[]) {
  return filters.reduce<Record<string, number>>((counts, filter) => {
    counts[filter.id] = applyTaskFilters(tasks, filter.query).filter((task) => task.status !== "done" && task.status !== "archived").length;
    return counts;
  }, {});
}

export function cleanFilterCriteria(criteria: FilterCriteria): FilterCriteria {
  return Object.fromEntries(
    Object.entries(criteria).filter(([, value]) => {
      if (typeof value === "string") {
        return value.trim().length > 0;
      }

      return Boolean(value);
    })
  ) as FilterCriteria;
}

export function getQuerySummary(criteria: FilterCriteria, projects: Project[] = []) {
  const parts: string[] = [];

  if (criteria.searchText) {
    parts.push(`search "${criteria.searchText}"`);
  }

  if (criteria.status) {
    parts.push(`status ${criteria.status}`);
  }

  if (criteria.priority) {
    parts.push(`${criteria.priority} priority`);
  }

  if (criteria.projectId === "none") {
    parts.push("no project");
  } else if (criteria.projectId) {
    parts.push(projects.find((project) => project.id === criteria.projectId)?.name ?? "selected project");
  }

  if (criteria.tag) {
    parts.push(`#${criteria.tag}`);
  }

  if (criteria.dueDateGroup) {
    parts.push(labelDueDateGroup(criteria.dueDateGroup));
  }

  if (criteria.energyLevel) {
    parts.push(`${criteria.energyLevel} energy`);
  }

  return parts.length > 0 ? parts.join(" · ") : "All tasks";
}

export function labelDueDateGroup(group: DueDateGroup) {
  switch (group) {
    case "no-due-date":
      return "No due date";
    case "overdue":
      return "Overdue";
    case "today":
      return "Today";
    case "tomorrow":
      return "Tomorrow";
    case "this-week":
      return "This week";
    case "later":
      return "Later";
  }
}

export function isFilterCriteria(value: unknown): value is FilterCriteria {
  if (!value || typeof value !== "object") {
    return false;
  }

  const criteria = value as FilterCriteria;
  return (
    (!criteria.status || taskStatuses.includes(criteria.status)) &&
    (!criteria.priority || priorities.includes(criteria.priority)) &&
    (!criteria.energyLevel || energyLevels.includes(criteria.energyLevel)) &&
    (!criteria.dueDateGroup || dueDateGroups.includes(criteria.dueDateGroup))
  );
}

function parseISODate(value: string) {
  const parts = value.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}
