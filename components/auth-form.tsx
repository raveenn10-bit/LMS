"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Mail, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(search.get("error") ? "Sign in link එක verify කරන්න බැරි වුණා." : "");

  async function submit(formData: FormData) {
    setLoading(true);
    setError("");
    setMessage("");
    const supabase = createClient();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const password = String(formData.get("password") || "");

    try {
      if (mode === "reset") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/update-password`,
        });
        if (resetError) throw resetError;
        setMessage("Password reset link එක email එකට යැව්වා.");
        return;
      }

      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login session එක create කරන්න බැරි වුණා. නැවත try කරන්න.");
      const { data: profile } = await supabase.from("lms_profiles").select("role").eq("id", user.id).single();
      if (profile?.role === "admin") {
        await supabase.auth.signOut();
        setError("මේක Student Login එක. Admin account එකෙන් /admin/login page එක භාවිතා කරන්න.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-heading">
        <span className="eyebrow">{mode === "reset" ? "RECOVER YOUR ACCOUNT" : "WELCOME BACK"}</span>
        <h1>{mode === "reset" ? "Reset your password." : "Ready for your next lesson?"}</h1>
        <p>Use the email and password given by your class administrator.</p>
      </div>
      <form action={submit} className="auth-form">
        <label>Email address<div className="field"><Mail size={17}/><input name="email" type="email" required autoComplete="email" placeholder="student@email.com"/></div></label>
        {mode !== "reset" && (
          <label>Password<div className="field"><input name="password" type={showPassword ? "text" : "password"} minLength={8} required autoComplete="current-password" placeholder="Minimum 8 characters"/><button type="button" aria-label="Show password" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
        )}
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}
        <button className="auth-submit" disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={19}/> : <>{mode === "reset" ? "Send reset link" : "Enter learning space"}<ArrowRight size={18}/></>}
        </button>
      </form>
      <button className="auth-reset" onClick={() => setMode(mode === "reset" ? "login" : "reset")}>
        {mode === "reset" ? "Back to login" : "Forgot your password?"}
      </button>
      <a className="auth-reset" href="https://wa.me/94764460100?text=Hello%20Sir%2C%20I%20need%20a%20student%20account." target="_blank" rel="noreferrer"><MessageCircle size={16}/> Need a student account?</a>
    </div>
  );
}
