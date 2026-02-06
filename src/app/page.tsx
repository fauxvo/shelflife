import { PlexLoginButton } from "@/components/auth/PlexLoginButton";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Plex Sync</h1>
          <p className="text-gray-400 text-lg">
            Manage your Plex library storage. Vote to keep or prune content you requested.
          </p>
        </div>
        <PlexLoginButton />
      </div>
    </main>
  );
}
