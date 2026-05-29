import { Archive, CheckCircle2, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import type { Habit, HabitFormValues, HabitFrequency } from "../types";
import { displayWithEmoji } from "../emojiPresets";
import { getCurrentWeekId, getHabitStatsForWeek, getWeekRange } from "../weeklyUtils";
import { getFriendlyError } from "../utils";
import { EmptyState, ProgressBar, StatusBanner } from "./Common";
import { EmojiPicker } from "./EmojiPicker";

const habitFrequencies: HabitFrequency[] = ["daily", "weekly", "custom"];

export function HabitsPage({
  habits,
  loading,
  todayDateId,
  onCreateHabit,
  onEditHabit,
  onArchiveHabit,
  onUnarchiveHabit,
  onDeleteHabit,
  onCompleteToday,
  onUndoToday,
}: {
  habits: Habit[];
  loading: boolean;
  todayDateId: string;
  onCreateHabit: () => void;
  onEditHabit: (habit: Habit) => void;
  onArchiveHabit: (habit: Habit) => void;
  onUnarchiveHabit: (habit: Habit) => void;
  onDeleteHabit: (habit: Habit) => void;
  onCompleteToday: (habit: Habit) => void;
  onUndoToday: (habit: Habit) => void;
}) {
  const weekRange = useMemo(() => getWeekRange(getCurrentWeekId()), []);
  const activeHabits = habits.filter((habit) => !habit.archived && habit.active);
  const archivedHabits = habits.filter((habit) => habit.archived || !habit.active);
  const weeklySummaries = useMemo(() => getHabitStatsForWeek(activeHabits, weekRange), [activeHabits, weekRange]);
  const weeklyCompleted = weeklySummaries.reduce((sum, habit) => sum + habit.completions, 0);
  const weeklyTarget = activeHabits.reduce((sum, habit) => sum + Math.max(1, Math.min(7, habit.targetPerWeek || 7)), 0);
  const weeklyRate = weeklyTarget > 0 ? Math.round((weeklyCompleted / weeklyTarget) * 100) : 0;

  return (
    <section className="habits-page">
      <section className="habits-hero panel">
        <div>
          <p className="eyebrow">Habits</p>
          <h3>Today's habit checklist</h3>
          <p>Keep repeatable actions visible and feed habit stability into Weekly Review.</p>
        </div>
        <button className="primary-button" type="button" onClick={onCreateHabit}>
          <Plus size={18} />
          New habit
        </button>
      </section>

      {loading ? <StatusBanner tone="info" message="Loading habits." /> : null}

      <section className="habit-summary-grid">
        <article className="weekly-stat-card">
          <span><CheckCircle2 size={18} /></span>
          <small>Today complete</small>
          <strong>{activeHabits.filter((habit) => habit.completionDates.includes(todayDateId)).length}/{activeHabits.length}</strong>
          <em>active habits</em>
        </article>
        <article className="weekly-stat-card">
          <span><CheckCircle2 size={18} /></span>
          <small>This week</small>
          <strong>{weeklyRate}%</strong>
          <em>{weeklyCompleted}/{weeklyTarget || 0} target completions</em>
        </article>
      </section>

      {!loading && habits.length === 0 ? (
        <EmptyState
          title="No habits yet"
          message="No habits yet. Create one small daily habit to start."
          action={
            <button className="primary-button" type="button" onClick={onCreateHabit}>
              <Plus size={18} />
              New habit
            </button>
          }
        />
      ) : null}

      <HabitSection
        title="Today's habits"
        habits={activeHabits}
        todayDateId={todayDateId}
        weekRange={weekRange}
        onEdit={onEditHabit}
        onArchive={onArchiveHabit}
        onUnarchive={onUnarchiveHabit}
        onDelete={onDeleteHabit}
        onCompleteToday={onCompleteToday}
        onUndoToday={onUndoToday}
      />

      <HabitSection
        title="Active habits"
        habits={activeHabits}
        todayDateId={todayDateId}
        weekRange={weekRange}
        onEdit={onEditHabit}
        onArchive={onArchiveHabit}
        onUnarchive={onUnarchiveHabit}
        onDelete={onDeleteHabit}
        onCompleteToday={onCompleteToday}
        onUndoToday={onUndoToday}
      />

      {archivedHabits.length > 0 ? (
        <details className="habit-archive panel">
          <summary>Archived habits ({archivedHabits.length})</summary>
          <HabitSection
            title="Archived habits"
            habits={archivedHabits}
            todayDateId={todayDateId}
            weekRange={weekRange}
            onEdit={onEditHabit}
            onArchive={onArchiveHabit}
            onUnarchive={onUnarchiveHabit}
            onDelete={onDeleteHabit}
            onCompleteToday={onCompleteToday}
            onUndoToday={onUndoToday}
          />
        </details>
      ) : null}
    </section>
  );
}

function HabitSection({
  title,
  habits,
  todayDateId,
  weekRange,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  onCompleteToday,
  onUndoToday,
}: {
  title: string;
  habits: Habit[];
  todayDateId: string;
  weekRange: ReturnType<typeof getWeekRange>;
  onEdit: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
  onUnarchive: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
  onCompleteToday: (habit: Habit) => void;
  onUndoToday: (habit: Habit) => void;
}) {
  if (habits.length === 0) {
    return null;
  }

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Habits</p>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="habit-grid">
        {habits.map((habit) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            todayDateId={todayDateId}
            weekRange={weekRange}
            onEdit={onEdit}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
            onDelete={onDelete}
            onCompleteToday={onCompleteToday}
            onUndoToday={onUndoToday}
          />
        ))}
      </div>
    </article>
  );
}

function HabitCard({
  habit,
  todayDateId,
  weekRange,
  onEdit,
  onArchive,
  onUnarchive,
  onDelete,
  onCompleteToday,
  onUndoToday,
}: {
  habit: Habit;
  todayDateId: string;
  weekRange: ReturnType<typeof getWeekRange>;
  onEdit: (habit: Habit) => void;
  onArchive: (habit: Habit) => void;
  onUnarchive: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
  onCompleteToday: (habit: Habit) => void;
  onUndoToday: (habit: Habit) => void;
}) {
  const todayDone = habit.completionDates.includes(todayDateId);
  const summary = getHabitStatsForWeek([habit], weekRange)[0];

  return (
    <article className={`habit-card ${todayDone ? "done" : ""}`} style={{ "--habit-color": habit.color } as CSSProperties}>
      <div className="habit-card-header">
        <span className="habit-dot" />
        <div>
          <strong>{displayWithEmoji(habit.name, habit.emoji)}</strong>
          <small>{habit.frequency} - target {habit.targetPerWeek}/week</small>
        </div>
        <span className={`status-pill ${todayDone ? "completed" : "upcoming"}`}>{todayDone ? "done today" : "open today"}</span>
      </div>
      {habit.description ? <p>{habit.description}</p> : null}
      <div className="habit-progress-row">
        <ProgressBar value={summary?.completionRate ?? 0} label={`${habit.name} weekly progress`} />
        <span>{summary?.completions ?? 0}/{habit.targetPerWeek} this week</span>
        <span>{habit.streak} day streak</span>
      </div>
      <div className="habit-actions">
        {habit.archived ? null : todayDone ? (
          <button className="secondary-button" type="button" onClick={() => onUndoToday(habit)}>
            <RotateCcw size={16} />
            Undo today
          </button>
        ) : (
          <button className="primary-button" type="button" onClick={() => onCompleteToday(habit)}>
            <CheckCircle2 size={16} />
            Done today
          </button>
        )}
        <button className="secondary-button" type="button" onClick={() => onEdit(habit)}>
          <Pencil size={16} />
          Edit
        </button>
        {!habit.archived ? (
          <button className="secondary-button" type="button" onClick={() => onArchive(habit)}>
            <Archive size={16} />
            Archive
          </button>
        ) : (
          <button className="secondary-button" type="button" onClick={() => onUnarchive(habit)}>
            <RotateCcw size={16} />
            Restore
          </button>
        )}
        <button className="secondary-button danger-button" type="button" onClick={() => onDelete(habit)}>
          <Trash2 size={16} />
          Delete
        </button>
      </div>
    </article>
  );
}

export function HabitForm({
  habit,
  onClose,
  onSave,
}: {
  habit: Habit | null;
  onClose: () => void;
  onSave: (values: HabitFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<HabitFormValues>({
    name: habit?.name ?? "",
    description: habit?.description ?? "",
    emoji: habit?.emoji ?? "",
    color: habit?.color ?? "#10b981",
    frequency: habit?.frequency ?? "daily",
    targetPerWeek: String(habit?.targetPerWeek ?? 7),
    active: habit?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    if (!values.name.trim()) {
      setError("Habit name is required.");
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
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="habit-editor-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{habit ? "Edit habit" : "Create habit"}</p>
            <h3 id="habit-editor-title">{habit ? habit.name : "New habit"}</h3>
          </div>
          <button type="button" className="icon-button task-icon-button" aria-label="Close habit editor" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="task-form" onSubmit={handleSubmit}>
          <label>
            Habit name
            <input required value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} />
          </label>

          <label>
            Description
            <textarea value={values.description} onChange={(event) => setValues({ ...values, description: event.target.value })} />
          </label>

          <div className="form-grid">
            <EmojiPicker label="Habit emoji" value={values.emoji} onChange={(emoji) => setValues({ ...values, emoji })} />

            <label>
              Frequency
              <select value={values.frequency} onChange={(event) => setValues({ ...values, frequency: event.target.value as HabitFrequency })}>
                {habitFrequencies.map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {frequency}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Target per week
              <input min="1" max="7" type="number" value={values.targetPerWeek} onChange={(event) => setValues({ ...values, targetPerWeek: event.target.value })} />
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
              {saving ? "Saving..." : "Save habit"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
