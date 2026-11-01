"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AdminAuthForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");
    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;
      const { data: profile, error: profileError } = await supabase.from("lms_profiles").select("role").eq("id", data.user.id).single();
      if (profileError || profile?.role !== "admin") {
        await supabase.auth.signOut();
        setError("මෙම account එකට Admin access නැහැ. Student Login page එක භාවිතා කරන්න.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Admin login failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="auth-card admin-login-card">
    <div className="admin-login-badge"><LockKeyhole size={18}/> SECURE ADMIN ACCESS</div>
    <div className="auth-heading">
      <span className="eyebrow">ADMIN CONTROL CENTRE</span>
      <h1>Welcome back.</h1>
      <p>Authorized administrators only. Students must use the separate student login.</p>
    </div>
    <form action={submit} className="auth-form">
      <label>Email address<div className="field"><Mail size={17}/><input name="email" type="email" required autoComplete="username" placeholder="admin@email.com"/></div></label>
      <label>Password<div className="field"><input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Admin password"/><button type="button" aria-label="Show password" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
      {error && <p className="form-error">{error}</p>}
      <button className="auth-submit admin-login-submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={19}/> : <>Enter admin dashboard <ArrowRight size={18}/></>}</button>
    </form>
    <a className="auth-reset" href="/login">Go to Student Login</a>
  </div>;
}
