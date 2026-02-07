"use client";

export function AppVersion({ className = "" }: { className?: string }) {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
  const sha = process.env.NEXT_PUBLIC_GIT_SHA;

  return (
    <span className={`text-xs text-gray-500 ${className}`}>
      v{version}
      {sha ? `-${sha}` : ""}
    </span>
  );
}
