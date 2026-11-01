"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return <main className="simple-auth-page"><form className="auth-card" onSubmit={async (event) => {
    event.preventDefault();
    setLoading(true);
    const password = new FormData(event.currentTarget).get("password") as string;
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (updateError) return setError(updateError.message);
    router.replace("/dashboard");
  }}><img src="/logo.svg" alt="Lavindu Maneth Mathematics"/><h1>Choose a new password.</h1><label>New password<div className="field"><input name="password" type="password" minLength={8} required/></div></label>{error && <p className="form-error">{error}</p>}<button className="auth-submit" disabled={loading}>{loading ? "Updating…" : "Update password"}</button></form></main>;
}
