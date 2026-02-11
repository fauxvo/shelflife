import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shelflife",
  description: "Manage your Plex library storage - vote to keep or prune requested content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">{children}</body>
    </html>
  );
}
