import { FirebaseError } from "firebase/app";
import { projectAreas, projectStatuses, priorities, taskStatuses, energyLevels } from "./constants";
import type { EnergyLevel, ProjectArea, ProjectStatus, TaskPriority, TaskStatus } from "./types";

export function getFriendlyError(error: unknown) {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use":
        return "That email already has an account. Try logging in instead.";
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "The email or password does not match an account.";
      case "auth/weak-password":
        return "Use a stronger password with at least six characters.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "permission-denied":
      case "firestore/permission-denied":
        return "The app could not save this change. Check that you are signed in and try again.";
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Try again.";
}

export function getTodayISODate() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

export function getNowISOString() {
  return new Date().toISOString();
}

export function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

export function formatProjectDate(value: { toDate?: () => Date } | string | null) {
  if (!value) {
    return "Not updated yet";
  }

  const date = typeof value === "string" ? new Date(value) : value.toDate?.();
  if (!date || Number.isNaN(date.getTime())) {
    return "Not updated yet";
  }

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && taskStatuses.includes(value as TaskStatus);
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && priorities.includes(value as TaskPriority);
}

export function isEnergyLevel(value: unknown): value is EnergyLevel {
  return typeof value === "string" && energyLevels.includes(value as EnergyLevel);
}

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return typeof value === "string" && projectStatuses.includes(value as ProjectStatus);
}

export function isProjectArea(value: unknown): value is ProjectArea {
  return typeof value === "string" && projectAreas.includes(value as ProjectArea);
}
