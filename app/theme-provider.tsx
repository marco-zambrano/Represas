"use client";

import type { ThemeProviderProps } from "next-themes";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Client boundary for the application color mode.
 *
 * `next-themes` writes the selected value to localStorage and sets it on the
 * document before paint. Keeping that work here lets layouts remain Server
 * Components while every route shares the same preference.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
