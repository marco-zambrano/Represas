"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AccessMode = "login" | "register";

export function LandingAccess() {
  const router = useRouter();
  const [mode, setMode] = useState<AccessMode>("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setMessage(undefined);
    const form = new FormData(event.currentTarget); const email = String(form.get("email") ?? ""); const password = String(form.get("password") ?? "");
    const supabase = createClient();
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/confirm` } });
    setLoading(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (mode === "login") { router.push("/dashboard"); return; }
    setMessage("Revisa tu correo para confirmar tu cuenta.");
  };

  return <section className="panel p-6 sm:p-8">
    <p className="eyebrow">Tu acceso al tablero</p>
    <h2 className="mt-3 text-3xl font-black">{mode === "login" ? "Ingresa a HidroVista" : "Crea tu cuenta"}</h2>
    <p className="mt-2 max-w-sm text-sm leading-6 text-[#527174]">{mode === "login" ? "Consulta el monitoreo de las centrales en un solo lugar." : "Te enviaremos un correo de confirmación para activar el acceso."}</p>
    <div className="mt-6 flex gap-2 rounded-xl bg-[#e8f2f1] p-1 text-sm font-bold"><button type="button" onClick={() => { setMode("login"); setMessage(undefined); }} className={`flex-1 rounded-lg px-3 py-2 ${mode === "login" ? "bg-white shadow-sm" : "text-[#527174]"}`}>Ingresar</button><button type="button" onClick={() => { setMode("register"); setMessage(undefined); }} className={`flex-1 rounded-lg px-3 py-2 ${mode === "register" ? "bg-white shadow-sm" : "text-[#527174]"}`}>Registrarme</button></div>
    <form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-sm font-bold">Correo electrónico<input name="email" type="email" autoComplete="email" required className="mt-2 w-full rounded-xl border border-[#b6ceca] bg-white px-4 py-3" /></label><label className="block text-sm font-bold">Contraseña<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={6} required className="mt-2 w-full rounded-xl border border-[#b6ceca] bg-white px-4 py-3" /></label><button disabled={loading} className="button button-primary w-full disabled:opacity-60">{loading ? "Procesando…" : mode === "login" ? "Ingresar al tablero" : "Crear cuenta"}</button></form>
    {mode === "login" && <Link href="/forgot-password" className="mt-4 inline-block text-sm font-bold text-[#007c8d]">Olvidé mi contraseña</Link>}
    {message && <p role="status" className="mt-4 rounded-xl bg-[#e0f5ee] p-3 text-sm text-[#075a55]">{message}</p>}
  </section>;
}
