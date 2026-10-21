"use server";
import { supabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
export async function login(form: FormData) {
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("password")),
  });
  if (error)
    redirect(
      "/login?error=" +
        encodeURIComponent("Unable to sign in. Check your email and password."),
    );
  redirect("/");
}
export async function logout() {
  const db = await supabase();
  await db.auth.signOut();
  redirect("/login");
}
