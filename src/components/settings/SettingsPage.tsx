import { AlertTriangle, Monitor, Moon, Paintbrush, ShieldCheck, Sparkles, Sun } from "lucide-react";
import type { User } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { firebaseEnvStatus } from "../../firebase";
import type { AppIconId, Project, SavedFilter, Task, ThemeMode, ThemePreset, UserSettings } from "../../types";
import {
  appIconOptions,
  createDefaultUserSettings,
  getAppIconDataUrl,
  getEffectiveAccentColor,
  getPresetAccentColor,
  getResolvedThemeMode,
  themePresets,
} from "../../themeUtils";
import type { ImportPreviewState } from "../../utils/backupUtils";
import { StatusBanner } from "../Common";
import { ReminderPermissionCard } from "../ReminderComponents";

export function SettingsPage({
  user,
  tasks,
  projects,
  savedFilters,
  tagCount,
  notificationPermission,
  onEnableNotifications,
  appearanceSettings,
  appearanceLoading,
  onSaveAppearance,
  installAvailable,
  installStatus,
  onInstall,
  backupBusy,
  backupStatus,
  importPreview,
  onExportData,
  onImportFile,
  onConfirmImport,
  onClearImport,
  onDeleteAppData,
  onDeleteAccount,
}: {
  user: User;
  tasks: Task[];
  projects: Project[];
  savedFilters: SavedFilter[];
  tagCount: number;
  notificationPermission: NotificationPermission | "unsupported";
  onEnableNotifications: () => Promise<void>;
  appearanceSettings: UserSettings;
  appearanceLoading: boolean;
  onSaveAppearance: (settings: UserSettings) => Promise<void>;
  installAvailable: boolean;
  installStatus: string;
  onInstall: () => Promise<void>;
  backupBusy: boolean;
  backupStatus: string;
  importPreview: ImportPreviewState;
  onExportData: () => Promise<void>;
  onImportFile: (file: File | null) => Promise<void>;
  onConfirmImport: () => void;
  onClearImport: () => void;
  onDeleteAppData: () => void;
  onDeleteAccount: () => void;
}) {
  const openCount = tasks.filter((task) => !["done", "archived"].includes(task.status)).length;
  const activeProjectCount = projects.filter((project) => project.status === "active" || project.status === "paused").length;
  const configuredCount = firebaseEnvStatus.filter((item) => item.configured).length;

  return (
    <section className="content-grid settings-grid">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Account</p>
            <h3>Signed-in profile</h3>
          </div>
          <ShieldCheck size={20} />
        </div>
        <dl className="settings-list">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>User ID</dt>
            <dd>{user.uid}</dd>
          </div>
          <div>
            <dt>Open tasks</dt>
            <dd>{openCount}</dd>
          </div>
          <div>
            <dt>Active projects</dt>
            <dd>{activeProjectCount}</dd>
          </div>
          <div>
            <dt>Saved views</dt>
            <dd>{savedFilters.length}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>{tagCount}</dd>
          </div>
        </dl>
      </article>

      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Firebase</p>
            <h3>Environment</h3>
          </div>
          <Sparkles size={20} />
        </div>
        <p className="panel-copy">
          {configuredCount} of {firebaseEnvStatus.length} Firebase variables are present in the Vite environment.
        </p>
        <div className="env-list">
          {firebaseEnvStatus.map((item) => (
            <span className={item.configured ? "configured" : ""} key={item.key}>
              {item.key}
            </span>
          ))}
        </div>
      </article>

      <AppearanceCard user={user} settings={appearanceSettings} loading={appearanceLoading} onSave={onSaveAppearance} />

      <ReminderPermissionCard permission={notificationPermission} onEnable={onEnableNotifications} />

      <InstallAppCard installAvailable={installAvailable} installStatus={installStatus} onInstall={onInstall} />

      <DataBackupCard
        backupBusy={backupBusy}
        backupStatus={backupStatus}
        importPreview={importPreview}
        onExportData={onExportData}
        onImportFile={onImportFile}
        onConfirmImport={onConfirmImport}
        onClearImport={onClearImport}
      />

      <DangerZoneCard backupBusy={backupBusy} onDeleteAppData={onDeleteAppData} onDeleteAccount={onDeleteAccount} />
    </section>
  );
}

function InstallAppCard({
  installAvailable,
  installStatus,
  onInstall,
}: {
  installAvailable: boolean;
  installStatus: string;
  onInstall: () => Promise<void>;
}) {
  return (
    <article className="panel settings-action-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Install LifeOS</p>
          <h3>Use it like an app</h3>
        </div>
        <Sparkles size={20} />
      </div>
      <p className="panel-copy">
        Install LifeOS from a supported browser, or use the browser menu to add it to your desktop or home screen.
      </p>
      <div className="settings-actions-row">
        <button className="secondary-button" type="button" onClick={() => void onInstall()}>
          {installAvailable ? "Install LifeOS" : "Show install help"}
        </button>
        <a className="ghost-button" href="#privacy">
          Privacy
        </a>
        <a className="ghost-button" href="#terms">
          Terms
        </a>
      </div>
      <p className="settings-helper">
        Desktop: use the install icon or browser menu. iPhone/Android: use Share or browser menu, then Add to Home Screen.
      </p>
      {installStatus ? <StatusBanner tone="info" message={installStatus} /> : null}
    </article>
  );
}

function AppearanceCard({
  user,
  settings,
  loading,
  onSave,
}: {
  user: User;
  settings: UserSettings;
  loading: boolean;
  onSave: (settings: UserSettings) => Promise<void>;
}) {
  const [draft, setDraft] = useState<UserSettings>(settings);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const accentColor = getEffectiveAccentColor(draft);
  const resolvedMode = getResolvedThemeMode(draft.themeMode);
  const isDirty = useMemo(
    () =>
      draft.themeMode !== settings.themeMode ||
      draft.themePreset !== settings.themePreset ||
      draft.accentColor !== settings.accentColor ||
      draft.appIcon !== settings.appIcon,
    [draft, settings]
  );

  useEffect(() => {
    setDraft(settings);
    setStatus("");
    setError("");
  }, [settings]);

  const updateDraft = (next: Partial<UserSettings>) => {
    setDraft((current) => ({ ...current, ...next }));
    setStatus("");
    setError("");
  };

  async function saveAppearance(nextSettings = draft) {
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await onSave(nextSettings);
      setStatus("Appearance saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save appearance.");
    } finally {
      setSaving(false);
    }
  }

  function resetAppearance() {
    const reset = createDefaultUserSettings(user.uid);
    setDraft(reset);
    setStatus("");
    setError("");
  }

  return (
    <article className="panel settings-action-card appearance-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Appearance</p>
          <h3>Themes and app icon</h3>
        </div>
        <Paintbrush size={20} />
      </div>
      <p className="panel-copy">
        Choose a light, dark, or system theme. Custom colors update LifeOS inside the app; installed PWA icons may need reinstalling to refresh.
      </p>

      <div className="appearance-preview">
        <img src={getAppIconDataUrl(draft.appIcon, accentColor, resolvedMode)} alt="" />
        <div>
          <strong>LifeOS</strong>
          <span>{resolvedMode === "dark" ? "Dark" : "Light"} · {themePresets.find((preset) => preset.id === draft.themePreset)?.name ?? "Custom"}</span>
        </div>
      </div>

      <fieldset className="appearance-fieldset">
        <legend>Theme mode</legend>
        <div className="theme-mode-grid" role="radiogroup" aria-label="Theme mode">
          {[
            { id: "system" as ThemeMode, label: "System", icon: Monitor },
            { id: "light" as ThemeMode, label: "Light", icon: Sun },
            { id: "dark" as ThemeMode, label: "Dark", icon: Moon },
          ].map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              className={draft.themeMode === id ? "theme-option active" : "theme-option"}
              aria-pressed={draft.themeMode === id}
              key={id}
              onClick={() => updateDraft({ themeMode: id })}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="appearance-fieldset">
        <legend>Accent color</legend>
        <div className="theme-swatch-grid">
          {themePresets.map((preset) => (
            <button
              type="button"
              className={draft.themePreset === preset.id ? "theme-swatch active" : "theme-swatch"}
              aria-pressed={draft.themePreset === preset.id}
              key={preset.id}
              onClick={() => updateDraft({ themePreset: preset.id, accentColor: preset.id === "custom" ? draft.accentColor : getPresetAccentColor(preset.id) })}
            >
              <span style={{ background: preset.id === "custom" ? draft.accentColor : preset.color }} />
              <strong>{preset.name}</strong>
              <small>{preset.description}</small>
            </button>
          ))}
        </div>
        <label className="custom-color-field">
          Custom color
          <input
            type="color"
            value={draft.accentColor}
            onChange={(event) => updateDraft({ themePreset: "custom", accentColor: event.target.value as `#${string}` })}
          />
        </label>
      </fieldset>

      <fieldset className="appearance-fieldset">
        <legend>App icon</legend>
        <div className="app-icon-grid">
          {appIconOptions.map((icon) => (
            <button
              type="button"
              className={draft.appIcon === icon.id ? "app-icon-choice active" : "app-icon-choice"}
              aria-pressed={draft.appIcon === icon.id}
              key={icon.id}
              onClick={() => updateDraft({ appIcon: icon.id as AppIconId })}
            >
              <img src={getAppIconDataUrl(icon.id, accentColor, resolvedMode)} alt="" />
              <span>{icon.name}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {error ? <StatusBanner tone="error" message={error} /> : null}
      {status ? <StatusBanner tone="success" message={status} /> : null}

      <div className="settings-actions-row">
        <button className="primary-button" type="button" onClick={() => void saveAppearance()} disabled={saving || loading || !isDirty}>
          {saving ? "Saving..." : isDirty ? "Save appearance" : "Appearance saved"}
        </button>
        <button className="ghost-button" type="button" onClick={resetAppearance} disabled={saving || loading}>
          Reset
        </button>
      </div>
    </article>
  );
}

function DataBackupCard({
  backupBusy,
  backupStatus,
  importPreview,
  onExportData,
  onImportFile,
  onConfirmImport,
  onClearImport,
}: {
  backupBusy: boolean;
  backupStatus: string;
  importPreview: ImportPreviewState;
  onExportData: () => Promise<void>;
  onImportFile: (file: File | null) => Promise<void>;
  onConfirmImport: () => void;
  onClearImport: () => void;
}) {
  return (
    <article className="panel settings-action-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Data & Backup</p>
          <h3>Export or restore your LifeOS data</h3>
        </div>
        <ShieldCheck size={20} />
      </div>
      <p className="panel-copy">
        Export a JSON backup of your user-owned Firestore data. Imports merge safely and skip documents when matching IDs already exist.
      </p>
      <div className="settings-actions-row">
        <button className="primary-button" type="button" onClick={() => void onExportData()} disabled={backupBusy}>
          Export JSON
        </button>
        <label className="secondary-button file-button">
          Choose backup
          <input type="file" accept="application/json,.json" onChange={(event) => void onImportFile(event.target.files?.[0] ?? null)} />
        </label>
      </div>
      {backupStatus ? <StatusBanner tone="info" message={backupStatus} /> : null}
      {importPreview.error ? <StatusBanner tone="error" message={importPreview.error} /> : null}
      {importPreview.status ? <StatusBanner tone="success" message={importPreview.status} /> : null}
      {importPreview.counts ? (
        <div className="backup-preview">
          <strong>{importPreview.fileName}</strong>
          <span>{importPreview.counts.tasks} tasks</span>
          <span>{importPreview.counts.projects} projects</span>
          <span>{importPreview.counts.habits} habits</span>
          <span>{importPreview.counts.habitCompletions} habit completions</span>
          <span>{importPreview.counts.weeklyReviews} weekly reviews</span>
          <span>{importPreview.counts.focusSessions} focus sessions</span>
          <span>{importPreview.counts.reminders} reminders</span>
          <div className="settings-actions-row">
            <button className="primary-button" type="button" onClick={onConfirmImport} disabled={backupBusy}>
              Import merge
            </button>
            <button className="ghost-button" type="button" onClick={onClearImport} disabled={backupBusy}>
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function DangerZoneCard({
  backupBusy,
  onDeleteAppData,
  onDeleteAccount,
}: {
  backupBusy: boolean;
  onDeleteAppData: () => void;
  onDeleteAccount: () => void;
}) {
  return (
    <article className="panel settings-action-card danger-zone">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Danger zone</p>
          <h3>Delete data</h3>
        </div>
        <AlertTriangle size={20} />
      </div>
      <p className="panel-copy">
        These actions are permanent. Delete app data keeps your Firebase Auth account. Delete account reauthenticates first, then removes app data and the Auth account.
      </p>
      <div className="settings-actions-row">
        <button className="secondary-button danger-button" type="button" onClick={onDeleteAppData} disabled={backupBusy}>
          Delete app data
        </button>
        <button className="secondary-button danger-button" type="button" onClick={onDeleteAccount} disabled={backupBusy}>
          Delete account
        </button>
      </div>
    </article>
  );
}
