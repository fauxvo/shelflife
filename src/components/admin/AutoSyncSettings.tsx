"use client";

import { useState } from "react";
import { Toast, type ToastData } from "@/components/ui/Toast";

interface AutoSyncSettingsProps {
  initialSettings: {
    enabled: boolean;
    schedule: string;
    syncType: "overseerr" | "tautulli" | "full";
  };
}

const SCHEDULE_PRESETS: { label: string; value: string }[] = [
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours", value: "0 */12 * * *" },
  { label: "Daily (midnight)", value: "0 0 * * *" },
  { label: "Weekly (Sunday midnight)", value: "0 0 * * 0" },
  { label: "Custom", value: "custom" },
];

const SYNC_TYPES: { label: string; value: string }[] = [
  { label: "Full", value: "full" },
  { label: "Overseerr Only", value: "overseerr" },
  { label: "Tautulli Only", value: "tautulli" },
];

function getPresetForSchedule(schedule: string): string {
  const preset = SCHEDULE_PRESETS.find((p) => p.value === schedule);
  return preset ? preset.value : "custom";
}

export function AutoSyncSettings({ initialSettings }: AutoSyncSettingsProps) {
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  const [schedule, setSchedule] = useState(initialSettings.schedule);
  const [selectedPreset, setSelectedPreset] = useState(
    getPresetForSchedule(initialSettings.schedule)
  );
  const [syncType, setSyncType] = useState(initialSettings.syncType);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  const handlePresetChange = (preset: string) => {
    setSelectedPreset(preset);
    if (preset !== "custom") {
      setSchedule(preset);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setToast(null);

    try {
      const res = await fetch("/api/admin/settings/sync-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, schedule, syncType }),
      });

      if (!res.ok) {
        const err = await res.json();
        setToast({
          message: err.error || "Failed to save settings",
          type: "error",
        });
        return;
      }

      setToast({ message: "Auto-sync settings saved", type: "success" });
    } catch {
      setToast({ message: "Failed to save settings", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Auto Sync</h3>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
            enabled ? "bg-brand" : "bg-gray-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-4">
          {/* Schedule Preset */}
          <div>
            <label className="mb-1 block text-sm text-gray-400">Schedule</label>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="focus:border-brand w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:outline-none"
            >
              {SCHEDULE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Cron Input */}
          {selectedPreset === "custom" && (
            <div>
              <label className="mb-1 block text-sm text-gray-400">Cron Expression</label>
              <input
                type="text"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="0 */6 * * *"
                className="focus:border-brand w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-gray-200 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Format: minute hour day-of-month month day-of-week
              </p>
            </div>
          )}

          {/* Sync Type */}
          <div>
            <label className="mb-1 block text-sm text-gray-400">Sync Type</label>
            <select
              value={syncType}
              onChange={(e) => setSyncType(e.target.value as typeof syncType)}
              className="focus:border-brand w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:outline-none"
            >
              {SYNC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Current Schedule Display */}
          <p className="text-xs text-gray-500">
            Schedule: <code className="text-gray-400">{schedule}</code>
          </p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-brand hover:bg-brand-hover rounded-md px-4 py-2 text-sm font-medium text-black transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </button>

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
