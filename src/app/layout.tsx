import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { ProviderLabelProvider } from "@/lib/provider-context";
import { getProviderInfo } from "@/lib/services/request-service";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Shelflife",
  description: "Manage your Plex library storage - vote to keep or prune requested content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { label, url } = await getProviderInfo();

  return (
    <html lang="en" className={`dark ${manrope.variable}`}>
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <ProviderLabelProvider label={label} url={url}>
          {children}
        </ProviderLabelProvider>
      </body>
    </html>
  );
}
