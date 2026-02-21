"use client";

import { createContext, useContext } from "react";

type ProviderLabel = "Seerr" | "Overseerr" | "Jellyseerr";

const ProviderLabelContext = createContext<ProviderLabel>("Overseerr");

export function ProviderLabelProvider({
  label,
  children,
}: {
  label: ProviderLabel;
  children: React.ReactNode;
}) {
  return <ProviderLabelContext.Provider value={label}>{children}</ProviderLabelContext.Provider>;
}

export function useProviderLabel(): ProviderLabel {
  return useContext(ProviderLabelContext);
}
