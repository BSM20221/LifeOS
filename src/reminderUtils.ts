import type { Reminder, SnoozeOption, Task } from "./types";
import { normalizeDueDateTime } from "./recurrenceUtils";

export type DueReminder = {
  task: Task;
  reminder: Reminder;
};

export const reminderPresetOptions = [
  { value: "at-due", label: "At due time", minutesBefore: 0 },
  { value: "before-5", label: "5 minutes before", minutesBefore: 5 },
  { value: "before-10", label: "10 minutes before", minutesBefore: 10 },
  { value: "before-30", label: "30 minutes before", minutesBefore: 30 },
  { value: "before-60", label: "1 hour before", minutesBefore: 60 },
  { value: "before-1440", label: "1 day before", minutesBefore: 1440 },
  { value: "custom", label: "Custom date/time", minutesBefore: null },
] as const;

export function createLocalReminderId() {
  return `reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function calculateReminderTime(dueDate: string, dueTime: string | null, minutesBefore: number) {
  const due = normalizeDueDateTime(dueDate, dueTime);
  if (!due) {
    return "";
  }

  return new Date(due.getTime() - minutesBefore * 60 * 1000).toISOString();
}

export function getDueReminders(tasks: Task[], now = new Date()): DueReminder[] {
  return tasks.flatMap((task) =>
    task.reminders
      .filter((reminder) => {
        if (!reminder.enabled || reminder.dismissedAt) {
          return false;
        }

        const dueAt = new Date(reminder.snoozedUntil || reminder.remindAt);
        return !Number.isNaN(dueAt.getTime()) && dueAt.getTime() <= now.getTime();
      })
      .map((reminder) => ({ task, reminder }))
  );
}

export function getNextReminder(tasks: Task[], now = new Date()) {
  return tasks
    .flatMap((task) => task.reminders.filter((reminder) => reminder.enabled && !reminder.dismissedAt).map((reminder) => ({ task, reminder })))
    .map((item) => ({ ...item, date: new Date(item.reminder.snoozedUntil || item.reminder.remindAt) }))
    .filter((item) => !Number.isNaN(item.date.getTime()) && item.date.getTime() >= now.getTime())
    .sort((left, right) => left.date.getTime() - right.date.getTime())[0] ?? null;
}

export function snoozeReminder(reminder: Reminder, option: SnoozeOption, now = new Date()): Reminder {
  const next = new Date(now);

  if (option === "5m") next.setMinutes(next.getMinutes() + 5);
  if (option === "10m") next.setMinutes(next.getMinutes() + 10);
  if (option === "30m") next.setMinutes(next.getMinutes() + 30);
  if (option === "1h") next.setHours(next.getHours() + 1);
  if (option === "tomorrow") {
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
  }

  return {
    ...reminder,
    snoozedUntil: next.toISOString(),
    firedAt: null,
    dismissedAt: null,
    updatedAt: now.toISOString(),
  };
}

export function dismissReminder(reminder: Reminder, now = new Date()): Reminder {
  return {
    ...reminder,
    firedAt: reminder.firedAt ?? now.toISOString(),
    dismissedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function markReminderFired(reminder: Reminder, now = new Date()): Reminder {
  return {
    ...reminder,
    firedAt: reminder.firedAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function formatReminderTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid reminder time";
  }

  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
