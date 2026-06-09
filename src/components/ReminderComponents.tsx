import { Bell, BellRing, CalendarClock, Clock3, Plus, Repeat2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  NotificationPermissionState,
  Reminder,
  RepeatEndType,
  RepeatFrequency,
  RepeatWeekday,
  SnoozeOption,
  Task,
  TaskFormValues,
} from "../types";
import { repeatEndTypes, repeatFrequencies, repeatWeekdays, formatRecurrenceSummary } from "../recurrenceUtils";
import { calculateReminderTime, createLocalReminderId, formatReminderTime, reminderPresetOptions, type DueReminder } from "../reminderUtils";
import { titleCase } from "../utils";
import { Button, EmptyState } from "./Common";
import { displayWithEmoji } from "../emojiPresets";

export function DueDateTimeFields({
  dueDate,
  dueTime,
  onChange,
}: {
  dueDate: string;
  dueTime: string;
  onChange: (values: { dueDate: string; dueTime: string }) => void;
}) {
  const dueTimeHelpId = "task-due-time-help";

  return (
    <fieldset className="due-date-time-fields">
      <legend>
        <CalendarClock size={15} />
        Due date & time
      </legend>
      <label>
        Date
        <input
          type="date"
          value={dueDate}
          onChange={(event) => onChange({ dueDate: event.target.value, dueTime: event.target.value ? dueTime : "" })}
        />
      </label>
      <label className={!dueDate ? "is-disabled" : ""}>
        Time
        {dueDate ? (
          <input type="time" value={dueTime} onChange={(event) => onChange({ dueDate, dueTime: event.target.value })} />
        ) : (
          <span className="disabled-time-placeholder" role="textbox" aria-disabled="true" aria-describedby={dueTimeHelpId}>
            No time
          </span>
        )}
      </label>
      {!dueDate ? (
        <small className="field-hint" id={dueTimeHelpId}>
          Choose a due date first to add a time.
        </small>
      ) : null}
    </fieldset>
  );
}

export function RecurrenceEditor({ values, onChange }: { values: TaskFormValues; onChange: (values: TaskFormValues) => void }) {
  const summaryTask = {
    ...values,
    id: "draft",
    userId: "",
    description: values.description,
    tags: [],
    dueTime: values.dueTime || null,
    estimatedMinutes: Number(values.estimatedMinutes || 0),
    completedOccurrences: values.completedOccurrences,
    repeatInterval: Number(values.repeatInterval || 1),
    repeatDayOfMonth: values.repeatDayOfMonth ? Number(values.repeatDayOfMonth) : null,
    repeatCount: values.repeatCount ? Number(values.repeatCount) : null,
    repeatEndDate: values.repeatEndDate || null,
    nextDueDate: values.nextDueDate || values.dueDate || null,
    lastGeneratedDate: values.lastGeneratedDate || null,
    recurringParentId: values.recurringParentId || null,
    isRecurringInstance: values.isRecurringInstance,
    createdAt: null,
    updatedAt: null,
    completedAt: null,
    isDemoData: false,
  } as Task;
  const summary = values.repeatEnabled ? formatRecurrenceSummary(summaryTask) || "Repeat is enabled" : "No repeat";

  function setRepeatEnabled(enabled: boolean) {
    onChange({
      ...values,
      repeatEnabled: enabled,
      repeatFrequency: enabled && values.repeatFrequency === "none" ? "daily" : values.repeatFrequency,
      nextDueDate: enabled ? values.dueDate : "",
    });
  }

  return (
    <section className={`task-advanced-section repeat-section ${values.repeatEnabled ? "is-expanded" : "is-collapsed"}`}>
      <div className="task-advanced-header compact-settings-header">
        <Repeat2 size={17} aria-hidden="true" />
        <div className="advanced-title-block">
          <strong>Repeat</strong>
          <span>{summary}</span>
        </div>
        <button
          type="button"
          className={`switch-control ${values.repeatEnabled ? "is-on" : ""}`}
          role="switch"
          aria-checked={values.repeatEnabled}
          aria-expanded={values.repeatEnabled}
          onClick={() => setRepeatEnabled(!values.repeatEnabled)}
        >
          <span>{values.repeatEnabled ? "On" : "Off"}</span>
        </button>
      </div>

      {values.repeatEnabled ? (
        <div className="recurrence-grid compact-settings-body">
          <label>
            Frequency
            <select value={values.repeatFrequency} onChange={(event) => onChange({ ...values, repeatFrequency: event.target.value as RepeatFrequency })}>
              {repeatFrequencies
                .filter((frequency) => frequency !== "none")
                .map((frequency) => (
                  <option value={frequency} key={frequency}>
                    {titleCase(frequency)}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Every
            <input
              min="1"
              type="number"
              value={values.repeatInterval}
              onChange={(event) => onChange({ ...values, repeatInterval: event.target.value })}
            />
          </label>

          {values.repeatFrequency === "weekly" ? (
            <fieldset className="weekday-picker">
              <legend>Repeat on</legend>
              {repeatWeekdays.map((weekday) => (
                <label key={weekday}>
                  <input
                    type="checkbox"
                    checked={values.repeatDaysOfWeek.includes(weekday)}
                    onChange={() =>
                      onChange({
                        ...values,
                        repeatDaysOfWeek: toggleWeekday(values.repeatDaysOfWeek, weekday),
                      })
                    }
                  />
                  {titleCase(weekday).slice(0, 3)}
                </label>
              ))}
            </fieldset>
          ) : null}

          {values.repeatFrequency === "monthly" ? (
            <label>
              Day of month
              <input
                min="1"
                max="31"
                type="number"
                value={values.repeatDayOfMonth}
                onChange={(event) => onChange({ ...values, repeatDayOfMonth: event.target.value })}
              />
            </label>
          ) : null}

          <label>
            Ends
            <select value={values.repeatEndType} onChange={(event) => onChange({ ...values, repeatEndType: event.target.value as RepeatEndType })}>
              {repeatEndTypes.map((endType) => (
                <option value={endType} key={endType}>
                  {endType === "never" ? "Repeat forever" : endType === "onDate" ? "Repeat until date" : "Repeat X times"}
                </option>
              ))}
            </select>
          </label>

          {values.repeatEndType === "onDate" ? (
            <label>
              End date
              <input type="date" value={values.repeatEndDate} onChange={(event) => onChange({ ...values, repeatEndDate: event.target.value })} />
            </label>
          ) : null}

          {values.repeatEndType === "afterCount" ? (
            <label>
              Repeat count
              <input min="1" type="number" value={values.repeatCount} onChange={(event) => onChange({ ...values, repeatCount: event.target.value })} />
              <small className="field-hint">{values.completedOccurrences} occurrences completed.</small>
            </label>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function ReminderEditor({ values, onChange }: { values: TaskFormValues; onChange: (values: TaskFormValues) => void }) {
  const [customDate, setCustomDate] = useState(values.dueDate);
  const [customTime, setCustomTime] = useState(values.dueTime || "09:00");
  const dueDateTimeAvailable = Boolean(values.dueDate && values.dueTime);
  const [preset, setPreset] = useState<(typeof reminderPresetOptions)[number]["value"]>(() => (dueDateTimeAvailable ? "at-due" : "custom"));
  const selectedPreset = reminderPresetOptions.find((option) => option.value === preset) ?? reminderPresetOptions[0];
  const canAddReminder = preset === "custom" ? Boolean(customDate && customTime) : dueDateTimeAvailable;
  const helperText = dueDateTimeAvailable
    ? "Choose when LifeOS should remind you."
    : "Due-based reminders need a due date and time. Custom reminders still work.";

  useEffect(() => {
    if (!dueDateTimeAvailable && preset !== "custom") {
      setPreset("custom");
    }
  }, [dueDateTimeAvailable, preset]);

  useEffect(() => {
    if (values.dueDate && !customDate) {
      setCustomDate(values.dueDate);
    }
  }, [customDate, values.dueDate]);

  function addReminder() {
    const now = new Date().toISOString();
    const isCustom = selectedPreset.value === "custom";
    const remindAt = isCustom ? customReminderIso(customDate, customTime) : calculateReminderTime(values.dueDate, values.dueTime, selectedPreset.minutesBefore ?? 0);

    if (!remindAt) {
      return;
    }

    const reminder: Reminder = {
      id: createLocalReminderId(),
      taskId: "",
      type: isCustom ? "custom" : selectedPreset.minutesBefore === 0 ? "at-time" : "before-due",
      remindAt,
      minutesBefore: isCustom ? null : selectedPreset.minutesBefore,
      enabled: true,
      firedAt: null,
      dismissedAt: null,
      snoozedUntil: null,
      createdAt: now,
      updatedAt: now,
    };
    onChange({ ...values, reminders: [...values.reminders, reminder] });
  }

  return (
    <section className="task-advanced-section reminder-section">
      <div className="task-advanced-header compact-settings-header">
        <Bell size={17} aria-hidden="true" />
        <div className="advanced-title-block">
          <strong>Reminders</strong>
          <span>{values.reminders.length > 0 ? `${values.reminders.length} reminder${values.reminders.length === 1 ? "" : "s"}` : "No reminders"}</span>
        </div>
      </div>

      {values.reminders.length > 0 ? (
        <div className="reminder-list">
          {values.reminders.map((reminder) => (
            <div className="reminder-editor-row" key={reminder.id}>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={reminder.enabled}
                  onChange={() =>
                    onChange({
                      ...values,
                      reminders: values.reminders.map((item) => (item.id === reminder.id ? { ...item, enabled: !item.enabled, updatedAt: new Date().toISOString() } : item)),
                    })
                  }
                />
                <span>
                  <strong>{titleCase(reminder.type.replace("-", " "))}</strong>
                  <em>{formatReminderTime(reminder.snoozedUntil || reminder.remindAt)}</em>
                </span>
              </label>
              <button type="button" className="icon-button task-icon-button" aria-label="Remove reminder" onClick={() => onChange({ ...values, reminders: values.reminders.filter((item) => item.id !== reminder.id) })}>
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="reminder-add-grid compact-reminder-composer">
        <label>
          Notify me
          <select value={preset} onChange={(event) => setPreset(event.target.value as typeof preset)}>
            {reminderPresetOptions.map((option) => (
              <option value={option.value} key={option.value} disabled={option.value !== "custom" && !dueDateTimeAvailable}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {preset === "custom" ? (
          <>
            <label>
              Reminder date
              <input type="date" value={customDate} onChange={(event) => setCustomDate(event.target.value)} />
            </label>
            <label>
              Reminder time
              <input type="time" value={customTime} onChange={(event) => setCustomTime(event.target.value)} />
            </label>
          </>
        ) : null}
        <Button type="button" variant="secondary" onClick={addReminder} disabled={!canAddReminder}>
          <Plus size={15} />
          Add reminder
        </Button>
      </div>
      <small className="field-hint">{helperText}</small>
    </section>
  );
}

export function RecurrenceSummary({ task }: { task: Task }) {
  const summary = formatRecurrenceSummary(task);
  return summary ? (
    <span className="recurrence-chip">
      <Repeat2 size={14} />
      {summary}
    </span>
  ) : null;
}

export function ReminderBadge({ task }: { task: Task }) {
  const activeReminder = task.reminders.find((reminder) => reminder.enabled && !reminder.dismissedAt);
  return activeReminder ? (
    <span className="reminder-chip">
      <Bell size={14} />
      {formatReminderTime(activeReminder.snoozedUntil || activeReminder.remindAt)}
    </span>
  ) : null;
}

export function ReminderCenter({
  dueReminders,
  onDismiss,
  onSnooze,
}: {
  dueReminders: DueReminder[];
  onDismiss: (task: Task, reminder: Reminder) => void;
  onSnooze: (task: Task, reminder: Reminder, option: SnoozeOption) => void;
}) {
  if (dueReminders.length === 0) {
    return null;
  }

  return (
    <section className="reminder-center panel" aria-live="polite">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Reminders</p>
          <h3>{dueReminders.length} due now</h3>
        </div>
        <BellRing size={20} />
      </div>
      <div className="reminder-center-list">
        {dueReminders.map(({ task, reminder }) => (
          <article className="reminder-center-item" key={`${task.id}-${reminder.id}`}>
            <div>
              <strong>{displayWithEmoji(task.title, task.emoji)}</strong>
              <span>
                {task.dueDate ? `Due ${task.dueDate}${task.dueTime ? ` at ${task.dueTime}` : ""}` : `Reminder ${formatReminderTime(reminder.remindAt)}`}
              </span>
            </div>
            <div className="reminder-center-actions">
              <Button type="button" variant="ghost" onClick={() => onSnooze(task, reminder, "5m")}>
                5m
              </Button>
              <Button type="button" variant="ghost" onClick={() => onSnooze(task, reminder, "10m")}>
                10m
              </Button>
              <Button type="button" variant="ghost" onClick={() => onSnooze(task, reminder, "30m")}>
                30m
              </Button>
              <Button type="button" variant="ghost" onClick={() => onSnooze(task, reminder, "1h")}>
                1h
              </Button>
              <Button type="button" variant="ghost" onClick={() => onSnooze(task, reminder, "tomorrow")}>
                Tomorrow
              </Button>
              <Button type="button" variant="secondary" onClick={() => onDismiss(task, reminder)}>
                Dismiss
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ReminderPermissionCard({
  permission,
  onEnable,
}: {
  permission: NotificationPermissionState;
  onEnable: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const label = useMemo(() => {
    if (permission === "unsupported") return "Notifications unsupported";
    if (permission === "granted") return "Notifications enabled";
    if (permission === "denied") return "Notifications blocked";
    return "Notifications not enabled";
  }, [permission]);

  async function handleEnable() {
    setBusy(true);
    try {
      await onEnable();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel reminder-permission-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Reminders</p>
          <h3>Notifications</h3>
        </div>
        <Bell size={20} />
      </div>
      <p className="panel-copy">Browser notifications work while LifeOS is open. Full background reminders will come in a future version.</p>
      <span className="status-pill">{label}</span>
      <Button type="button" variant="secondary" onClick={() => void handleEnable()} disabled={busy || permission === "granted" || permission === "unsupported"}>
        {busy ? "Requesting..." : "Enable notifications"}
      </Button>
    </article>
  );
}

function toggleWeekday(days: RepeatWeekday[], day: RepeatWeekday) {
  return days.includes(day) ? days.filter((candidate) => candidate !== day) : [...days, day];
}

function customReminderIso(date: string, time: string) {
  if (!date || !time) {
    return "";
  }

  const value = new Date(`${date}T${time}:00`);
  return Number.isNaN(value.getTime()) ? "" : value.toISOString();
}
