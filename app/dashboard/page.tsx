import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Dashboard } from "./dashboard";

export default async function DashboardPage() {
  const supabase = await createClient(); const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims) redirect("/login");
  return <Dashboard email={String(claimsData.claims.email ?? "Usuario")} />;
}
