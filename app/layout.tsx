import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HidroVista | Energía que se entiende",
  description: "Monitoreo transparente de las principales centrales hidroeléctricas del Ecuador.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
