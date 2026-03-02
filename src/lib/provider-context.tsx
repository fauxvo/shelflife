"use client";

import { createContext, useContext } from "react";

type ProviderLabel = "Seerr" | "Overseerr" | "Jellyseerr";
type StatsProviderLabel = "Tautulli" | "Tracearr";
type StatsProviderId = "tautulli" | "tracearr";

interface ProviderContextValue {
  label: ProviderLabel;
  url?: string;
  statsLabel: StatsProviderLabel;
  statsProviderId: StatsProviderId;
}

const ProviderContext = createContext<ProviderContextValue>({
  label: "Overseerr",
  statsLabel: "Tautulli",
  statsProviderId: "tautulli",
});

export function ProviderLabelProvider({
  label,
  url,
  statsLabel,
  statsProviderId,
  children,
}: {
  label: ProviderLabel;
  url?: string;
  statsLabel: StatsProviderLabel;
  statsProviderId: StatsProviderId;
  children: React.ReactNode;
}) {
  return (
    <ProviderContext.Provider value={{ label, url, statsLabel, statsProviderId }}>
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
