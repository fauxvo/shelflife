import { PlexLoginButton } from "@/components/auth/PlexLoginButton";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center p-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/login-bg.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative z-10 max-w-md w-full text-center space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Shelflife</h1>
          <p className="text-gray-400 text-lg">
            Manage your Plex library storage. Vote to keep or prune content you
            requested.
          </p>
        </div>
        <PlexLoginButton />
      </div>
    </main>
  );
}
