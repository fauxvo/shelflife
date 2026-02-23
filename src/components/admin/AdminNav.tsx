"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Sync", href: "/admin/sync" },
  { label: "Reviews", href: "/admin/reviews" },
];

export function AdminNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <nav className="mx-auto flex max-w-7xl gap-1 px-4">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            isActive(item.href)
              ? "border-brand text-brand"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
