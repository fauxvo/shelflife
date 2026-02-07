import { PlexLoginButton } from "@/components/auth/PlexLoginButton";
import { AppVersion } from "@/components/ui/AppVersion";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/login-bg.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative z-10 w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Shelflife</h1>
          <p className="text-lg text-gray-400">
            Manage your Plex library storage. Vote to keep or prune content you requested.
          </p>
        </div>
        <PlexLoginButton />
      </div>
      <AppVersion className="absolute right-4 bottom-4 z-10" />
    </main>
  );
}
