import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { AppVersion } from "@/components/ui/AppVersion";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.isAdmin) redirect("/");

  return (
    <div className="min-h-screen">
      <header className="border-t-brand sticky top-0 z-10 border-t-2 border-b border-b-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-extrabold tracking-tight">Shelflife</h1>
              <span className="text-gray-600">/</span>
              <span className="text-base font-medium text-gray-400">Admin</span>
              <AppVersion />
            </div>
            <p className="text-sm text-gray-500">Library management overview</p>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-gray-200">
              Dashboard
            </Link>
            <Link href="/community" className="text-sm text-gray-400 hover:text-gray-200">
              Community
            </Link>
            <span className="text-brand text-sm font-medium">Admin</span>
            <form action="/api/auth/logout" method="POST">
              <button className="text-sm text-gray-400 hover:text-gray-200">Sign Out</button>
            </form>
          </nav>
        </div>
        <AdminNav />
      </header>
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">{children}</main>
    </div>
  );
}
