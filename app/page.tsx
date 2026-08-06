import { LandingAccess } from "./landing-access";
import { HangingBulb } from "./hanging-bulb";

const sources = [
  { name: "CELEC", detail: "Telemetría de generación, caudal y operación." },
  { name: "GEOGLOWS", detail: "Pronósticos de caudal por tramo de río." },
  { name: "INAMHI", detail: "Niveles y lluvia para el contexto hidrológico." },
];

export default function HomePage() {
  return <main className="shell flex h-dvh flex-col justify-center overflow-hidden py-4 sm:py-6">
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_116px_minmax(360px,.9fr)]">
      <section className="hidden lg:block">
        <p className="eyebrow">Ecuador · monitoreo hidroeléctrico</p>
        <h1 className="mt-4 max-w-2xl text-5xl font-black leading-[.95] tracking-tight sm:text-7xl">HidroVista</h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-[#315a5d]">Información clara y trazable sobre el estado de las principales centrales hidroeléctricas ecuatorianas.</p>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {sources.map((source) => <article className="panel p-5" key={source.name}><h2 className="text-lg font-black">{source.name}</h2><p className="mt-2 text-sm leading-6 text-[#527174]">{source.detail}</p></article>)}
        </div>
      </section>
      <div className="hidden lg:block"><HangingBulb /></div>
      <LandingAccess />
    </div>
  </main>;
}
