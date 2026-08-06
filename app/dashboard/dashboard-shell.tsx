"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/app/theme-toggle";

const navigation = [
  { href: "/dashboard", label: "Panorama hidroeléctrico" },
  { href: "/dashboard/demanda-nacional", label: "Demanda nacional" },
  { href: "/dashboard/agente", label: "Agente HidroVista" },
];

export function DashboardShell({ email, children }: { email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  };

  return <main className="dashboard-page min-h-screen">
    <header className="dashboard-header relative z-30 border-b">
      <div className="shell flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
        <Link href="/dashboard" className="text-xl font-black tracking-tight">Hidro<span className="text-[var(--accent)]">Vista</span></Link>
        <nav aria-label="Secciones del tablero" className="order-3 flex w-full gap-1 overflow-x-auto rounded-xl p-1 md:order-none md:w-auto">
          {navigation.map((item) => {
            const active = pathname === item.href;
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`dashboard-nav-link ${active ? "dashboard-nav-link-active" : ""}`}>{item.label}</Link>;
          })}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden max-w-44 truncate text-[var(--muted)] sm:inline">{email}</span>
          <button onClick={signOut} className="sign-out-button" title="Cerrar sesión" aria-label="Cerrar sesión">
            <span>Salir</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
              <path d="M14 8l4 4-4 4M18 12H7M10 5H5.8A1.8 1.8 0 0 0 4 6.8v10.4A1.8 1.8 0 0 0 5.8 19H10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </button>
        </div>
      </div>
      <ThemeToggle inHeader className="dashboard-theme-toggle" />
    </header>
    {children}
  </main>;
}
