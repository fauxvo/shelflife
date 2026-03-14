"use client";

import { createContext, useContext } from "react";

type ProviderLabel = "Seerr" | "Overseerr" | "Jellyseerr";
type StatsProviderLabel = "Tautulli" | "Tracearr";
type StatsProviderId = "tautulli" | "tracearr";

export interface ConfiguredServices {
  sonarr: boolean;
  radarr: boolean;
  seerr: boolean;
}

interface ProviderContextValue {
  label: ProviderLabel;
  url?: string;
  statsLabel: StatsProviderLabel;
  statsProviderId: StatsProviderId;
  configuredServices: ConfiguredServices;
}

const ProviderContext = createContext<ProviderContextValue>({
  label: "Overseerr",
  statsLabel: "Tautulli",
  statsProviderId: "tautulli",
  configuredServices: { sonarr: false, radarr: false, seerr: false },
});

export function ProviderLabelProvider({
  label,
  url,
  statsLabel,
  statsProviderId,
  configuredServices,
  children,
}: {
  label: ProviderLabel;
  url?: string;
  statsLabel: StatsProviderLabel;
  statsProviderId: StatsProviderId;
  configuredServices: ConfiguredServices;
  children: React.ReactNode;
}) {
  return (
    <ProviderContext.Provider
      value={{ label, url, statsLabel, statsProviderId, configuredServices }}
    >
      {children}
    </ProviderContext.Provider>
  );
}

export function useProviderLabel(): ProviderLabel {
  return useContext(ProviderContext).label;
}

export function useProviderUrl(): string | undefined {
  return useContext(ProviderContext).url;
}

export function useStatsProviderLabel(): StatsProviderLabel {
  return useContext(ProviderContext).statsLabel;
}

export function useStatsProviderId(): StatsProviderId {
  return useContext(ProviderContext).statsProviderId;
}

export function useConfiguredServices(): ConfiguredServices {
  return useContext(ProviderContext).configuredServices;
}
