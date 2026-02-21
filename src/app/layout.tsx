import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { ProviderLabelProvider } from "@/lib/provider-context";
import { getProviderLabel } from "@/lib/services/request-service";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Shelflife",
  description: "Manage your Plex library storage - vote to keep or prune requested content",
};

function resolveProviderLabel(): "Seerr" | "Overseerr" | "Jellyseerr" {
  try {
    return getProviderLabel();
  } catch {
    return "Overseerr";
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const providerLabel = resolveProviderLabel();

  return (
    <html lang="en" className={`dark ${manrope.variable}`}>
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <ProviderLabelProvider label={providerLabel}>{children}</ProviderLabelProvider>
      </body>
    </html>
  );
}
