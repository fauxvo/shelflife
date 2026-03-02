"use client";

import { createContext, useContext } from "react";

type ProviderLabel = "Seerr" | "Overseerr" | "Jellyseerr";

interface ProviderContextValue {
  label: ProviderLabel;
  url?: string;
}

const ProviderContext = createContext<ProviderContextValue>({ label: "Overseerr" });

export function ProviderLabelProvider({
  label,
  url,
  children,
}: {
  label: ProviderLabel;
  url?: string;
  children: React.ReactNode;
}) {
  return <ProviderContext.Provider value={{ label, url }}>{children}</ProviderContext.Provider>;
}

export function useProviderLabel(): ProviderLabel {
  return useContext(ProviderContext).label;
}

export function useProviderUrl(): string | undefined {
  return useContext(ProviderContext).url;
}
