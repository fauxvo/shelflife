"use client";

import { useState, useEffect, useCallback } from "react";
import { Toast, type ToastData } from "@/components/ui/Toast";

type ServiceType = "seerr" | "overseerr" | "jellyseerr" | "tautulli" | "sonarr" | "radarr";

interface ServiceState {
  url: string;
  apiKey: string;
  status: "unconfigured" | "configured" | "connected" | "error";
  errorMessage?: string;
  testing?: boolean;
}

const SERVICE_INFO: Record<ServiceType, { name: string; description: string; logo: string }> = {
  seerr: {
    name: "Seerr",
    description: "Request management (primary)",
    logo: "/logos/seerr.svg",
  },
  overseerr: {
    name: "Overseerr",
    description: "Request management (legacy)",
    logo: "/logos/overseerr.svg",
  },
  jellyseerr: {
    name: "Jellyseerr",
    description: "Request management (Jellyfin)",
    logo: "/logos/jellyseerr.svg",
  },
  tautulli: {
    name: "Tautulli",
    description: "Watch history and statistics",
    logo: "/logos/tautulli.svg",
  },
  sonarr: {
    name: "Sonarr",
    description: "TV show management (optional)",
    logo: "/logos/sonarr.png",
  },
  radarr: {
    name: "Radarr",
    description: "Movie management (optional)",
    logo: "/logos/radarr.png",
  },
};

const SERVICE_ORDER: ServiceType[] = [
  "seerr",
  "overseerr",
  "jellyseerr",
  "tautulli",
  "sonarr",
  "radarr",
];

const PROVIDER_OPTIONS = [
  { value: "auto", label: "Auto-detect" },
  { value: "seerr", label: "Seerr" },
  { value: "overseerr", label: "Overseerr" },
  { value: "jellyseerr", label: "Jellyseerr" },
];

export function ServiceSettings() {
  const [services, setServices] = useState<Record<ServiceType, ServiceState>>(() => {
    const init = {} as Record<ServiceType, ServiceState>;
    for (const type of SERVICE_ORDER) {
      init[type] = { url: "", apiKey: "", status: "unconfigured" };
    }
    return init;
  });
  const [activeProvider, setActiveProvider] = useState("auto");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  // Track original API keys from server to detect "unchanged masked keys"
  const [originalMaskedKeys, setOriginalMaskedKeys] = useState<Record<ServiceType, string>>(
    {} as Record<ServiceType, string>
  );

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/services");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = await res.json();

      const maskedKeys = {} as Record<ServiceType, string>;
      const newServices = {} as Record<ServiceType, ServiceState>;
      for (const type of SERVICE_ORDER) {
        const config = data.services[type];
        if (config) {
          newServices[type] = {
            url: config.url,
            apiKey: config.apiKey,
            status: "configured",
          };
          maskedKeys[type] = config.apiKey;
        } else {
          newServices[type] = { url: "", apiKey: "", status: "unconfigured" };
          maskedKeys[type] = "";
        }
      }
      setServices(newServices);
      setOriginalMaskedKeys(maskedKeys);
      setActiveProvider(data.activeProvider || "auto");
    } catch {
      setToast({ message: "Failed to load service settings", type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateService = (type: ServiceType, field: "url" | "apiKey", value: string) => {
    setServices((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
        status: prev[type].url || value ? "configured" : "unconfigured",
      },
    }));
  };

  const testConnection = async (type: ServiceType) => {
    const service = services[type];
    if (!service.url || !service.apiKey) return;

    // Don't test with masked API key
    if (service.apiKey === originalMaskedKeys[type]) {
      setToast({ message: "Enter a new API key to test the connection", type: "error" });
      return;
    }

    setServices((prev) => ({
      ...prev,
      [type]: { ...prev[type], testing: true },
    }));

    try {
      const res = await fetch("/api/admin/settings/services/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, url: service.url, apiKey: service.apiKey }),
      });
      const result = await res.json();

      setServices((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          testing: false,
          status: result.success ? "connected" : "error",
          errorMessage: result.success ? undefined : result.message,
        },
      }));
    } catch {
      setServices((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          testing: false,
          status: "error",
          errorMessage: "Test request failed",
        },
      }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setToast(null);

    try {
      const payload: Record<string, { url: string; apiKey: string } | null> = {};
      for (const type of SERVICE_ORDER) {
        const service = services[type];
        if (service.url && service.apiKey) {
          // Skip saving if the API key hasn't changed (still masked)
          if (service.apiKey === originalMaskedKeys[type]) {
            continue; // Don't include unchanged services
          }
          payload[type] = { url: service.url, apiKey: service.apiKey };
        } else if (!service.url && !service.apiKey && originalMaskedKeys[type]) {
          // User cleared both fields — remove config
          payload[type] = null;
        }
      }

      const res = await fetch("/api/admin/settings/services", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services: payload, activeProvider }),
      });

      if (!res.ok) {
        const err = await res.json();
        setToast({ message: err.error || "Failed to save settings", type: "error" });
        return;
      }

      setToast({ message: "Service settings saved", type: "success" });
      // Reload to get updated masked keys
      await loadSettings();
    } catch {
      setToast({ message: "Failed to save settings", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 p-8 text-gray-400">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Loading settings...
      </div>
    );
  }

  // Filter provider options to only show configured ones (plus auto)
  const availableProviders = PROVIDER_OPTIONS.filter(
    (opt) => opt.value === "auto" || services[opt.value as ServiceType]?.url
  );

  return (
    <div className="space-y-6">
      {/* Service Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {SERVICE_ORDER.map((type) => {
          const info = SERVICE_INFO[type];
          const service = services[type];
          return (
            <div key={type} className="rounded-lg border border-gray-800 bg-gray-900 p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={info.logo} alt={info.name} className="h-8 w-8 rounded object-contain" />
                  <div>
                    <h3 className="font-semibold">{info.name}</h3>
                    <p className="text-xs text-gray-500">{info.description}</p>
                  </div>
                </div>
                <StatusBadge status={service.status} />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-400">URL</label>
                  <input
                    type="text"
                    value={service.url}
                    onChange={(e) => updateService(type, "url", e.target.value)}
                    placeholder={`http://your-server:port`}
                    className="focus:border-brand w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">API Key</label>
                  <input
                    type="password"
                    value={service.apiKey}
                    onChange={(e) => updateService(type, "apiKey", e.target.value)}
                    placeholder="Enter API key"
                    className="focus:border-brand w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
                  />
                </div>

                {service.errorMessage && (
                  <p className="text-xs text-red-400">{service.errorMessage}</p>
                )}

                <button
                  onClick={() => testConnection(type)}
                  disabled={!service.url || !service.apiKey || service.testing}
                  className="rounded-md bg-gray-700 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {service.testing ? "Testing..." : "Test Connection"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Request Provider Selection */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
        <h3 className="mb-1 font-semibold">Request Provider</h3>
        <p className="mb-3 text-xs text-gray-500">
          Which service handles media requests. &quot;Auto-detect&quot; picks the first configured
          service (Seerr &gt; Overseerr &gt; Jellyseerr).
        </p>
        <select
          value={activeProvider}
          onChange={(e) => setActiveProvider(e.target.value)}
          className="focus:border-brand rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 focus:outline-none"
        >
          {availableProviders.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand hover:bg-brand-hover rounded-md px-6 py-2 text-sm font-medium text-black transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

function StatusBadge({ status }: { status: ServiceState["status"] }) {
  switch (status) {
    case "connected":
      return (
        <span className="rounded bg-green-900/50 px-2 py-0.5 text-xs font-medium text-green-300">
          Connected
        </span>
      );
    case "error":
      return (
        <span className="rounded bg-red-900/50 px-2 py-0.5 text-xs font-medium text-red-300">
          Error
        </span>
      );
    case "configured":
      return (
        <span className="rounded bg-blue-900/50 px-2 py-0.5 text-xs font-medium text-blue-300">
          Configured
        </span>
      );
    default:
      return (
        <span className="rounded bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500">
          Not configured
        </span>
      );
  }
}
