import type { Timestamp } from "firebase/firestore";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "inbox" | "today" | "upcoming" | "done" | "archived";
export type EnergyLevel = "low" | "medium" | "high";
export type ProjectStatus = "active" | "paused" | "completed" | "archived";
export type ProjectArea = "Study" | "Business" | "Health" | "Client Work" | "Personal" | "Other";
export type DueDateGroup = "no-due-date" | "overdue" | "today" | "tomorrow" | "this-week" | "later";
export type TimeBlockType = "deep-work" | "study" | "admin" | "health" | "break" | "personal" | "other";
export type MoodLevel = "low" | "okay" | "good" | "great";
export type FocusMode = "pomodoro" | "short-break" | "long-break" | "custom";
export type FocusStatus = "running" | "paused" | "completed" | "cancelled";
export type HabitFrequency = "daily" | "weekly" | "custom";
export type RepeatFrequency = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom";
export type RepeatEndType = "never" | "onDate" | "afterCount";
export type RepeatWeekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type ReminderType = "at-time" | "before-due" | "custom";
export type SnoozeOption = "5m" | "10m" | "30m" | "1h" | "tomorrow";
export type NotificationPermissionState = NotificationPermission | "unsupported";
export type InsightSeverity = "info" | "success" | "warning" | "danger";
export type AnalyticsRange = "today" | "7-days" | "30-days" | "this-month" | "this-year" | "all-time" | "custom";
export type PerformanceStatus = "Strong" | "Healthy" | "Needs attention" | "Neglected" | "Stuck";
export type WeekId = string;
export type ProjectHealthStatus = "healthy" | "at-risk" | "stuck" | "paused";
export type WeeklyProjectAction = "continue" | "pause" | "cleanup";
export type WeeklyProjectReviewState = WeeklyProjectAction | null;
export type ReportingRange = "today" | "7-days" | "30-days" | "this-month" | "this-year" | "all-time" | "custom";
export type ReportingViewMode = "daily" | "weekly" | "monthly" | "yearly";
export type ReportingType =
  | "focus-minutes"
  | "completed-tasks"
  | "planned-vs-completed"
  | "priority-completion"
  | "project-comparison"
  | "area-comparison"
  | "tag-performance";
export type ReportingTaskStatus = "all" | "open" | "today" | "upcoming" | "completed" | "archived" | "overdue";
export type QuoteCategory =
  | "discipline"
  | "focus"
  | "learning"
  | "patience"
  | "courage"
  | "wisdom"
  | "resilience"
  | "humility"
  | "ambition";

export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  dueTime: string | null;
  tags: string[];
  estimatedMinutes: number;
  energyLevel: EnergyLevel;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  completedAt: Timestamp | null;
  notes: string;
  userId: string;
  projectId: string | null;
  emoji: string | null;
  icon: string | null;
  repeatEnabled: boolean;
  repeatFrequency: RepeatFrequency;
  repeatInterval: number;
  repeatDaysOfWeek: RepeatWeekday[];
  repeatDayOfMonth: number | null;
  repeatEndType: RepeatEndType;
  repeatEndDate: string | null;
  repeatCount: number | null;
  completedOccurrences: number;
  nextDueDate: string | null;
  lastGeneratedDate: string | null;
  recurringParentId: string | null;
  isRecurringInstance: boolean;
  reminders: Reminder[];
  isDemoData?: boolean;
};

export type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  dueTime: string;
  tags: string;
  estimatedMinutes: string;
  energyLevel: EnergyLevel;
  notes: string;
  projectId: string;
  emoji: string;
  icon: string;
  repeatEnabled: boolean;
  repeatFrequency: RepeatFrequency;
  repeatInterval: string;
  repeatDaysOfWeek: RepeatWeekday[];
  repeatDayOfMonth: string;
  repeatEndType: RepeatEndType;
  repeatEndDate: string;
  repeatCount: string;
  completedOccurrences: number;
  nextDueDate: string;
  lastGeneratedDate: string;
  recurringParentId: string;
  isRecurringInstance: boolean;
  reminders: Reminder[];
};

export type RecurrenceRule = {
  repeatEnabled: boolean;
  repeatFrequency: RepeatFrequency;
  repeatInterval: number;
  repeatDaysOfWeek: RepeatWeekday[];
  repeatDayOfMonth: number | null;
  repeatEndType: RepeatEndType;
  repeatEndDate: string | null;
  repeatCount: number | null;
  completedOccurrences: number;
  nextDueDate: string | null;
  lastGeneratedDate: string | null;
};

export type Reminder = {
  id: string;
  taskId: string;
  type: ReminderType;
  remindAt: string;
  minutesBefore: number | null;
  enabled: boolean;
  firedAt: string | null;
  dismissedAt: string | null;
  snoozedUntil: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type Project = {
  id: string;
  userId: string;
  name: string;
  description: string;
  color: string;
  status: ProjectStatus;
  area: ProjectArea;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  archivedAt: string | null;
  completedAt: string | null;
  emoji: string | null;
  icon: string | null;
  isDemoData?: boolean;
};

export type ProjectFormValues = {
  name: string;
  description: string;
  color: string;
  status: ProjectStatus;
  area: ProjectArea;
  emoji: string;
  icon: string;
};

export type ProjectStats = {
  openTasks: number;
  completedTasks: number;
  totalTasks: number;
  progress: number;
};

export type FilterCriteria = {
  searchText?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string | "none";
  tag?: string;
  dueDateGroup?: DueDateGroup;
  energyLevel?: EnergyLevel;
};

export type SavedFilter = {
  id: string;
  userId: string;
  name: string;
  description: string;
  query: FilterCriteria;
  color: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type SavedFilterFormValues = {
  name: string;
  description: string;
  color: string;
  query: FilterCriteria;
};

export type TagCount = {
  tag: string;
  openTasks: number;
  completedTasks: number;
  totalTasks: number;
};

export type TimeBlock = {
  id: string;
  taskId: string | null;
  title: string;
  startTime: string;
  endTime: string;
  type: TimeBlockType;
  notes: string;
  completed: boolean;
};

export type DailyReflection = {
  wentWell: string;
  distractions: string;
  improveTomorrow: string;
  energyLevel: EnergyLevel | null;
  mood: MoodLevel | null;
};

export type DailyPlan = {
  id: string;
  userId: string;
  date: string;
  topTaskIds: string[];
  deepWorkTaskId: string | null;
  timeBlocks: TimeBlock[];
  reflection: DailyReflection;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  isDemoData?: boolean;
};

export type TimeBlockFormValues = {
  taskId: string;
  title: string;
  startTime: string;
  endTime: string;
  type: TimeBlockType;
  notes: string;
  completed: boolean;
};

export type TodayStats = {
  todayTasks: number;
  overdueTasks: number;
  totalEstimatedMinutes: number;
  completedToday: number;
  topCompleted: number;
};

export type FocusSession = {
  id: string;
  userId: string;
  taskId: string | null;
  projectId: string | null;
  dailyPlanDate: string;
  mode: FocusMode;
  plannedMinutes: number;
  actualMinutes: number;
  status: FocusStatus;
  startedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  isDemoData?: boolean;
};

export type FocusStats = {
  completedSessions: number;
  totalFocusedMinutes: number;
  minutesByProject: Record<string, number>;
  minutesByTask: Record<string, number>;
};

export type Habit = {
  id: string;
  userId: string;
  name: string;
  description: string;
  emoji: string | null;
  color: string;
  frequency: HabitFrequency;
  targetPerWeek: number;
  active: boolean;
  archived: boolean;
  archivedAt: string | null;
  completionDates: string[];
  completions: HabitCompletion[];
  streak: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type HabitCompletion = {
  id: string;
  habitId: string;
  userId: string;
  date: string;
  completedAt: Timestamp | string | null;
  note: string;
};

export type HabitFormValues = {
  name: string;
  description: string;
  emoji: string;
  color: string;
  frequency: HabitFrequency;
  targetPerWeek: string;
  active: boolean;
};

export type WeeklyReview = {
  id: string;
  userId: string;
  weekId: WeekId;
  weekStartDate: string;
  weekEndDate: string;
  completedTaskIds: string[];
  reviewedProjectIds: string[];
  topWins: string;
  biggestStruggles: string;
  lessonsLearned: string;
  whatToStopDoing: string;
  whatToContinueDoing: string;
  whatToStartDoing: string;
  improveNextWeek: string;
  whatToImproveNextWeek: string;
  nextWeekPriorityTaskIds: string[];
  nextWeekProjectIds: string[];
  nextWeekNotes: string;
  projectReviewActions: Record<string, WeeklyProjectAction>;
  projectReviewStates: Record<string, WeeklyProjectReviewState>;
  habitReflection: string;
  focusReflection: string;
  moodSummary: string;
  energySummary: string;
  rating: number | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  completedAt: string | null;
};

export type WeeklyReviewStats = {
  completedTasks: number;
  focusMinutes: number;
  completedFocusSessions: number;
  habitsCompleted: number;
  habitCompletionRate: number | null;
  overdueTasks: number;
  projectsTouched: number;
  topProjectByFocus: string;
  topTagByCompleted: string;
};

export type WeeklyHabitSummary = {
  habitId: string;
  name: string;
  emoji: string | null;
  completions: number;
  targetPerWeek: number;
  completionRate: number;
  missedDays: number;
  streak: number;
};

export type WeeklyFocusSummary = {
  focusMinutes: number;
  completedSessions: number;
  averageSessionMinutes: number;
  bestFocusDay: string;
  focusByProject: Array<{ projectId: string | null; name: string; emoji: string | null; minutes: number }>;
  focusByTask: Array<{ taskId: string | null; title: string; emoji: string | null; minutes: number }>;
};

export type WeeklyInsightMessage = {
  id: string;
  title: string;
  message: string;
  severity: InsightSeverity;
};

export type InsightMessage = {
  id: string;
  title: string;
  message: string;
  severity: InsightSeverity;
};

export type Quote = {
  id: string;
  text: string;
  author: string;
  category: QuoteCategory;
  context: string;
};

export type ChartDatum = {
  label: string;
  value: number;
  color?: string;
  detail?: string;
};

export type ChartSeries = {
  label: string;
  data: ChartDatum[];
  color?: string;
};

export type DateBucket = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type PriorityCompletionStats = {
  priority: TaskPriority;
  completed: number;
  open: number;
  overdue: number;
};

export type PlannedVsCompletedStats = {
  planned: number;
  completed: number;
  topThreePlanned: number;
  topThreeCompleted: number;
  timeBlocksPlanned: number;
  timeBlocksCompleted: number;
};

export type TagPerformanceStats = {
  tag: string;
  openTasks: number;
  completedTasks: number;
  totalTasks: number;
};

export type ProjectPerformance = {
  projectId: string;
  name: string;
  emoji: string | null;
  area: ProjectArea;
  color: string;
  completedTasks: number;
  focusMinutes: number;
  openTasks: number;
  overdueTasks: number;
  urgentHighOpen: number;
  priorityCompleted: number;
  lastActivityDate: string;
  daysSinceActivity: number | null;
  score: number;
  status: PerformanceStatus;
  message: string;
};

export type AreaPerformance = {
  area: ProjectArea | "Uncategorized";
  emoji: string | null;
  completedTasks: number;
  focusMinutes: number;
  openTasks: number;
  overdueTasks: number;
  urgentHighOpen: number;
  priorityCompleted: number;
  lastActivityDate: string;
  daysSinceActivity: number | null;
  score: number;
  status: PerformanceStatus;
  message: string;
};

export type PerformanceRecommendation = {
  id: string;
  title: string;
  message: string;
  severity: InsightSeverity;
  action: string;
  projectId?: string;
  area?: ProjectArea | "Uncategorized";
};

export type ConfirmDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  variant: "normal" | "destructive";
  requiredPhrase?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  passwordRequired?: boolean;
  onConfirm: (password?: string) => Promise<void> | void;
};

export type FavoriteQuote = {
  id: string;
  userId: string;
  quoteId: string;
  createdAt: Timestamp | null;
};

export type ReportingFilters = {
  range: ReportingRange;
  viewMode: ReportingViewMode;
  reportType: ReportingType;
  projectId: string | "all" | "uncategorized";
  area: ProjectArea | "all" | "Uncategorized";
  tag: string | "all";
  priority: TaskPriority | "all";
  taskStatus: ReportingTaskStatus;
  focusMode: FocusMode | "all";
  includeDemoData: boolean;
  customStart: string;
  customEnd: string;
};

export type ReportingBucket = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type ReportingSeries = {
  key: string;
  label: string;
  color: string;
};

export type ReportingMetric = {
  label: string;
  value: string;
  detail: string;
};

export type ReportingTableColumn = {
  key: string;
  label: string;
};

export type ReportingTableRow = Record<string, string | number>;

export type ReportingExplanation = {
  title: string;
  message: string;
};

export type ReportingRecommendation = {
  id: string;
  title: string;
  message: string;
  severity: InsightSeverity;
  action: string;
};

export type ReportingDataset = {
  title: string;
  subtitle: string;
  chartData: ReportingTableRow[];
  series: ReportingSeries[];
  metrics: ReportingMetric[];
  columns: ReportingTableColumn[];
  rows: ReportingTableRow[];
  explanation: ReportingExplanation;
  recommendations: ReportingRecommendation[];
  emptyTitle: string;
  emptyMessage: string;
  summary: string;
};

export type DemoSeedResult = {
  projects: number;
  tasks: number;
  focusSessions: number;
  dailyPlans: number;
};
