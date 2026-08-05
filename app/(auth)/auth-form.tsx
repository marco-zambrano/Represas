"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register" | "forgot" | "reset";
const copy: Record<Mode, { title: string; hint: string; action: string }> = {
  login: { title: "Bienvenido de vuelta", hint: "Ingresa para consultar el tablero operativo.", action: "Ingresar" },
  register: { title: "Crea tu acceso", hint: "Te enviaremos un enlace para confirmar tu correo.", action: "Crear cuenta" },
  forgot: { title: "Recupera tu acceso", hint: "Recibirás un enlace seguro para elegir una nueva contraseña.", action: "Enviar enlace" },
  reset: { title: "Nueva contraseña", hint: "Elige una contraseña segura para tu cuenta.", action: "Actualizar contraseña" },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const [message, setMessage] = useState<string>(); const [loading, setLoading] = useState(false);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setMessage(undefined);
    const data = new FormData(event.currentTarget); const email = String(data.get("email") || ""); const password = String(data.get("password") || "");
    const supabase = createClient(); const origin = window.location.origin;
    let error: { message: string } | null = null;
    if (mode === "login") { ({ error } = await supabase.auth.signInWithPassword({ email, password })); if (!error) window.location.assign("/dashboard"); }
    if (mode === "register") ({ error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/confirm` } }));
    if (mode === "forgot") ({ error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/reset-password` }));
    if (mode === "reset") ({ error } = await supabase.auth.updateUser({ password }));
    setLoading(false); setMessage(error ? error.message : mode === "login" ? "Redirigiendo…" : mode === "reset" ? "Contraseña actualizada. Ya puedes ingresar." : "Revisa tu correo para continuar.");
  };
  const isPassword = mode === "login" || mode === "register" || mode === "reset";
  return <main className="shell flex min-h-screen items-center justify-center py-10"><section className="panel w-full max-w-md p-7 sm:p-9"><Link href="/" className="text-xl font-black">Hidro<span className="text-[#007c8d]">Vista</span></Link><p className="eyebrow mt-8">Acceso seguro</p><h1 className="mt-3 text-3xl font-black">{copy[mode].title}</h1><p className="mt-3 text-[#527174]">{copy[mode].hint}</p><form className="mt-7 space-y-4" onSubmit={handleSubmit}>{mode !== "reset" && <label className="block text-sm font-bold">Correo electrónico<input className="mt-2 w-full rounded-xl border border-[#b6ceca] bg-white px-4 py-3" required type="email" name="email" autoComplete="email" /></label>}{isPassword && <label className="block text-sm font-bold">Contraseña<input className="mt-2 w-full rounded-xl border border-[#b6ceca] bg-white px-4 py-3" required minLength={6} type="password" name="password" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>}<button className="button button-primary w-full disabled:opacity-60" disabled={loading}>{loading ? "Procesando…" : copy[mode].action}</button></form>{message && <p role="status" className="mt-5 rounded-xl bg-[#e0f5ee] p-3 text-sm text-[#075a55]">{message}</p>}<div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold text-[#007c8d]">{mode === "login" && <><Link href="/register">Crear cuenta</Link><Link href="/forgot-password">Olvidé mi contraseña</Link></>}{mode === "register" && <Link href="/login">Ya tengo una cuenta</Link>}{mode === "forgot" && <Link href="/login">Volver a ingresar</Link>}</div></section></main>;
}
