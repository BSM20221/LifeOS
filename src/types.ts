import type { Timestamp } from "firebase/firestore";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "inbox" | "today" | "upcoming" | "done" | "archived";
export type EnergyLevel = "low" | "medium" | "high";

export type Task = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  tags: string[];
  estimatedMinutes: number;
  energyLevel: EnergyLevel;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  completedAt: Timestamp | null;
  notes: string;
  userId: string;
};

export type TaskFormValues = {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  tags: string;
  estimatedMinutes: string;
  energyLevel: EnergyLevel;
  notes: string;
};
