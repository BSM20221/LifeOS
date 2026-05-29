export type BackupCounts = {
  tasks: number;
  projects: number;
  savedViews: number;
  dailyPlans: number;
  focusSessions: number;
  favoriteQuotes: number;
  habits: number;
  habitCompletions: number;
  weeklyReviews: number;
  reminders: number;
};

export type LifeOSBackup = {
  exportVersion: 1;
  appVersion: string;
  exportedAt: string;
  data: {
    tasks: Array<Record<string, unknown>>;
    projects: Array<Record<string, unknown>>;
    filters: Array<Record<string, unknown>>;
    dailyPlans: Array<Record<string, unknown>>;
    focusSessions: Array<Record<string, unknown>>;
    favoriteQuotes: Array<Record<string, unknown>>;
    habits: Array<Record<string, unknown> & { completions?: Array<Record<string, unknown>> }>;
    weeklyReviews: Array<Record<string, unknown>>;
    settings: Record<string, unknown> | null;
  };
};

export type ImportPreviewState = {
  fileName: string;
  backup: LifeOSBackup | null;
  counts: BackupCounts | null;
  error: string;
  status: string;
};

export function toBackupArray(values: unknown[]) {
  return values.map((value) => serializeForBackup(value) as Record<string, unknown>);
}

export function serializeForBackup(value: unknown): unknown {
  if (!value) {
    return value;
  }

  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeForBackup);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => typeof entry !== "function")
        .map(([key, entry]) => [key, serializeForBackup(entry)])
    );
  }

  return value;
}

export function validateBackup(value: unknown): LifeOSBackup {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("This is not a valid LifeOS backup file.");
  }

  const backup = value as Partial<LifeOSBackup>;
  const data = backup.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Backup file is missing its data section.");
  }

  return {
    exportVersion: 1,
    appVersion: String(backup.appVersion ?? "unknown"),
    exportedAt: String(backup.exportedAt ?? new Date().toISOString()),
    data: {
      tasks: asBackupArray(data.tasks),
      projects: asBackupArray(data.projects),
      filters: asBackupArray(data.filters),
      dailyPlans: asBackupArray(data.dailyPlans),
      focusSessions: asBackupArray(data.focusSessions),
      favoriteQuotes: asBackupArray(data.favoriteQuotes),
      habits: asBackupArray(data.habits) as LifeOSBackup["data"]["habits"],
      weeklyReviews: asBackupArray(data.weeklyReviews),
      settings: data.settings && typeof data.settings === "object" && !Array.isArray(data.settings) ? (data.settings as Record<string, unknown>) : null,
    },
  };
}

export function countBackupData(backup: LifeOSBackup): BackupCounts {
  const habitCompletions = backup.data.habits.reduce((count, habit) => count + (Array.isArray(habit.completions) ? habit.completions.length : 0), 0);
  const reminders = backup.data.tasks.reduce((count, task) => count + (Array.isArray(task.reminders) ? task.reminders.length : 0), 0);

  return {
    tasks: backup.data.tasks.length,
    projects: backup.data.projects.length,
    savedViews: backup.data.filters.length,
    dailyPlans: backup.data.dailyPlans.length,
    focusSessions: backup.data.focusSessions.length,
    favoriteQuotes: backup.data.favoriteQuotes.length,
    habits: backup.data.habits.length,
    habitCompletions,
    weeklyReviews: backup.data.weeklyReviews.length,
    reminders,
  };
}

export function prepareImportedDoc(item: Record<string, unknown>, id: string, userId: string) {
  return {
    ...item,
    id,
    userId,
  };
}

export function downloadBackup(backup: LifeOSBackup) {
  const dateId = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lifeos-backup-${dateId}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function asBackupArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)) : [];
}
