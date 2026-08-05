import Link from "next/link";

const sources = ["CELEC", "GEOGLOWS", "INAMHI", "CENACE"];
const plants = ["Mazar", "Paute-Molino", "Sopladora", "Minas San Francisco", "Agoyán", "Coca Codo Sinclair"];

export default function HomePage() {
  return (
    <main>
      <header className="shell flex items-center justify-between py-6">
        <Link href="/" className="text-xl font-black tracking-tight">Hidro<span className="text-[#007c8d]">Vista</span></Link>
        <div className="flex gap-3"><Link className="button button-secondary" href="/login">Ingresar</Link><Link className="button button-primary" href="/register">Crear cuenta</Link></div>
      </header>
      <section className="shell grid gap-10 py-16 lg:grid-cols-[1.2fr_.8fr] lg:py-24">
        <div className="max-w-3xl"><p className="eyebrow">Ecuador · monitoreo hidroeléctrico</p><h1 className="mt-5 text-5xl font-black leading-[.95] tracking-tight sm:text-7xl">La energía del agua, clara y en contexto.</h1><p className="mt-7 max-w-xl text-lg leading-8 text-[#315a5d]">HidroVista reúne telemetría operativa, caudal y pronósticos de las principales centrales hidroeléctricas del país en un tablero que explica cada cifra.</p><div className="mt-9 flex flex-wrap gap-3"><Link className="button button-primary" href="/register">Explorar el tablero</Link><a className="button button-secondary" href="#fuentes">Ver fuentes</a></div></div>
        <div className="panel relative overflow-hidden p-7"><div className="absolute inset-x-0 top-0 h-2 bg-[#00a6a6]" /><p className="eyebrow">Lectura responsable</p><h2 className="mt-4 text-2xl font-bold">Datos observados ≠ pronósticos</h2><p className="mt-4 leading-7 text-[#315a5d]">Cada serie indica su fuente, unidad y hora de actualización. Los valores estimados se muestran separados de la telemetría publicada.</p><div className="mt-8 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-[#e0f5ee] p-4"><strong className="block text-2xl">6</strong>centrales cubiertas</div><div className="rounded-xl bg-[#e8f2f1] p-4"><strong className="block text-2xl">4</strong>fuentes enlazadas</div></div></div>
      </section>
      <section className="shell py-14"><p className="eyebrow">Cobertura inicial</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{plants.map((plant, index) => <div className="panel p-5" key={plant}><span className="text-sm text-[#007c8d]">0{index + 1}</span><h2 className="mt-6 text-xl font-bold">{plant}</h2><p className="mt-2 text-sm text-[#527174]">Energía, caudal, cota y unidades cuando la fuente los publica.</p></div>)}</div></section>
      <section id="fuentes" className="shell py-16"><div className="panel p-7 md:p-10"><p className="eyebrow">Trazabilidad</p><h2 className="mt-3 text-3xl font-black">Las fuentes forman parte de la respuesta.</h2><p className="mt-4 max-w-3xl leading-7 text-[#315a5d]">Las instituciones publican datos en formatos y ventanas distintas. HidroVista conserva sus unidades, fecha de corte y limitaciones; no equipara cifras que no son comparables.</p><div className="mt-7 flex flex-wrap gap-3">{sources.map(source => <span className="rounded-full border border-[#b6ceca] px-4 py-2 text-sm font-bold" key={source}>{source}</span>)}</div></div></section>
      <footer className="shell border-t border-[#d7e3df] py-8 text-sm text-[#527174]">HidroVista · Datos públicos para comprensión, no para operación.</footer>
    </main>
  );
}
