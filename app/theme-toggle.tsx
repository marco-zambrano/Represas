"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

type ThemeToggleProps = {
  className?: string;
  inHeader?: boolean;
};

const subscribeToHydration = () => () => undefined;
const getClientHydrationState = () => true;
const getServerHydrationState = () => false;

/** A compact, keyboard-accessible control that is safe to render on any route. */
export function ThemeToggle({ className = "", inHeader = false }: ThemeToggleProps) {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationState,
    getServerHydrationState,
  );

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  // DashboardShell renders this control inside its header so it scrolls with it.
  if (!inHeader && pathname.startsWith("/dashboard")) return null;

  return (
    <button
      aria-label={label}
      aria-pressed={mounted ? isDark : undefined}
      className={`theme-toggle ${className}`.trim()}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      title={label}
      type="button"
    >
      {isDark ? (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.72 5.28l-1.42 1.42M6.7 17.3l-1.42 1.42M18.72 18.72 17.3 17.3M6.7 6.7 5.28 5.28" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
      ) : (
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <path d="M20.5 14.25A8.5 8.5 0 0 1 9.75 3.5 8.5 8.5 0 1 0 20.5 14.25Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
      )}
      <span className="sr-only">{label}</span>
    </button>
  );
}
