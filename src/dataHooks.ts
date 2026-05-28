import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Project, ProjectStats, SavedFilter, Task } from "./types";
import { isFilterCriteria, normalizeTags } from "./filterUtils";
import { getFriendlyError, isEnergyLevel, isProjectArea, isProjectStatus, isTaskPriority, isTaskStatus } from "./utils";

export function useUserTasks(user: User) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const taskQuery = query(collection(db, "users", user.uid, "tasks"), orderBy("createdAt", "desc"));
    return onSnapshot(
      taskQuery,
      (snapshot) => {
        setTasks(snapshot.docs.map(mapTaskDocument));
        setLoading(false);
      },
      (snapshotError) => {
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );
  }, [user.uid]);

  return { tasks, loading, error };
}

export function useUserProjects(user: User) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const projectQuery = query(collection(db, "users", user.uid, "projects"), orderBy("updatedAt", "desc"));
    return onSnapshot(
      projectQuery,
      (snapshot) => {
        setProjects(snapshot.docs.map(mapProjectDocument));
        setLoading(false);
      },
      (snapshotError) => {
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );
  }, [user.uid]);

  return { projects, loading, error };
}

export function useUserSavedFilters(user: User) {
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const filterQuery = query(collection(db, "users", user.uid, "filters"), orderBy("updatedAt", "desc"));
    return onSnapshot(
      filterQuery,
      (snapshot) => {
        setFilters(snapshot.docs.map(mapSavedFilterDocument));
        setLoading(false);
      },
      (snapshotError) => {
        setError(getFriendlyError(snapshotError));
        setLoading(false);
      }
    );
  }, [user.uid]);

  return { filters, loading, error };
}

export function getProjectStats(projectId: string, tasks: Task[]): ProjectStats {
  const projectTasks = tasks.filter((task) => task.projectId === projectId && task.status !== "archived");
  const completedTasks = projectTasks.filter((task) => task.status === "done").length;
  const openTasks = projectTasks.filter((task) => task.status !== "done").length;
  const totalTasks = openTasks + completedTasks;

  return {
    openTasks,
    completedTasks,
    totalTasks,
    progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
  };
}

function mapTaskDocument(snapshot: QueryDocumentSnapshot<DocumentData>): Task {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    title: String(data.title ?? "Untitled task"),
    description: String(data.description ?? ""),
    status: isTaskStatus(data.status) ? data.status : "inbox",
    priority: isTaskPriority(data.priority) ? data.priority : "medium",
    dueDate: String(data.dueDate ?? ""),
    tags: Array.isArray(data.tags) ? normalizeTags(data.tags.map(String)) : [],
    estimatedMinutes: Number(data.estimatedMinutes ?? 25),
    energyLevel: isEnergyLevel(data.energyLevel) ? data.energyLevel : "medium",
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    completedAt: data.completedAt ?? null,
    notes: String(data.notes ?? ""),
    userId: String(data.userId ?? ""),
    projectId: typeof data.projectId === "string" ? data.projectId : null,
  };
}

function mapSavedFilterDocument(snapshot: QueryDocumentSnapshot<DocumentData>): SavedFilter {
  const data = snapshot.data();
  return {
    id: typeof data.id === "string" ? data.id : snapshot.id,
    userId: String(data.userId ?? ""),
    name: String(data.name ?? "Untitled view"),
    description: String(data.description ?? ""),
    query: isFilterCriteria(data.query) ? data.query : {},
    color: String(data.color ?? "#2a5f48"),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };
}

function mapProjectDocument(snapshot: QueryDocumentSnapshot<DocumentData>): Project {
  const data = snapshot.data();
  return {
    id: typeof data.id === "string" ? data.id : snapshot.id,
    userId: String(data.userId ?? ""),
    name: String(data.name ?? "Untitled project"),
    description: String(data.description ?? ""),
    color: String(data.color ?? "#2a5f48"),
    status: isProjectStatus(data.status) ? data.status : "active",
    area: isProjectArea(data.area) ? data.area : "Other",
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    archivedAt: typeof data.archivedAt === "string" ? data.archivedAt : null,
    completedAt: typeof data.completedAt === "string" ? data.completedAt : null,
  };
}
