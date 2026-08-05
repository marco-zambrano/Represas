import { LandingAccess } from "./landing-access";
import { HangingBulb } from "./hanging-bulb";

const sources = [
  { name: "CELEC", detail: "Telemetría de generación, caudal y operación." },
  { name: "GEOGLOWS", detail: "Pronósticos de caudal por tramo de río." },
  { name: "INAMHI", detail: "Niveles y lluvia para el contexto hidrológico." },
];

export default function HomePage() {
  return <main className="shell relative flex min-h-screen flex-col justify-center py-10 sm:py-16">
    <HangingBulb />
    <div className="grid items-center gap-10 lg:grid-cols-[1fr_.95fr]">
      <section>
        <p className="eyebrow">Ecuador · monitoreo hidroeléctrico</p>
        <h1 className="mt-4 max-w-2xl text-5xl font-black leading-[.95] tracking-tight sm:text-7xl">HidroVista</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[#315a5d]">Información clara y trazable sobre el estado de las principales centrales hidroeléctricas ecuatorianas.</p>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {sources.map((source) => <article className="panel p-5" key={source.name}><h2 className="text-lg font-black">{source.name}</h2><p className="mt-2 text-sm leading-6 text-[#527174]">{source.detail}</p></article>)}
        </div>
      </section>
      <LandingAccess />
    </div>
    <footer className="mt-12 border-t border-[#d7e3df] pt-6 text-sm text-[#527174]">Datos públicos para comprensión, no para operación.</footer>
  </main>;
}
