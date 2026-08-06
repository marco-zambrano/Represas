import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";

export const metadata: Metadata = {
  title: "HidroVista | Energía que se entiende",
  description: "Monitoreo transparente de las principales centrales hidroeléctricas del Ecuador.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          {children}
          <ThemeToggle />
        </ThemeProvider>
      </body>
    </html>
  );
}
