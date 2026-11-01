"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Mail, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function AuthForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
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

      if (mode === "signup") {
        const fullName = String(formData.get("fullName") || "").trim();
        const phone = String(formData.get("phone") || "").trim();
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, phone },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setError("Account එක හැදුණා, නමුත් auto-login setting එක තවම active නැහැ. Admin එකට දැනුම් දෙන්න.");
          return;
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
        if (loginError) throw loginError;
      }

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
      <div className="auth-tabs">
        <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Student login</button>
        <button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Create account</button>
      </div>
      <div className="auth-heading">
        <span className="eyebrow">{mode === "signup" ? "START YOUR LEARNING SPACE" : mode === "reset" ? "RECOVER YOUR ACCOUNT" : "WELCOME BACK"}</span>
        <h1>{mode === "signup" ? "Let’s get started." : mode === "reset" ? "Reset your password." : "Ready for your next lesson?"}</h1>
        <p>{mode === "signup" ? "Register once, submit your payment slip and access approved classes." : "Use the email and password connected to your student account."}</p>
      </div>
      <form action={submit} className="auth-form">
        {mode === "signup" && (
          <>
            <label>Full name<div className="field"><UserRound size={17}/><input name="fullName" required autoComplete="name" placeholder="Your full name"/></div></label>
            <label>WhatsApp number<div className="field"><span>+94</span><input name="phone" required autoComplete="tel" placeholder="77 123 4567"/></div></label>
          </>
        )}
        <label>Email address<div className="field"><Mail size={17}/><input name="email" type="email" required autoComplete="email" placeholder="student@email.com"/></div></label>
        {mode !== "reset" && (
          <label>Password<div className="field"><input name="password" type={showPassword ? "text" : "password"} minLength={8} required autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="Minimum 8 characters"/><button type="button" aria-label="Show password" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>
        )}
        {error && <p className="form-error">{error}</p>}
        {message && <p className="form-success">{message}</p>}
        <button className="auth-submit" disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={19}/> : <>{mode === "signup" ? "Create my account" : mode === "reset" ? "Send reset link" : "Enter learning space"}<ArrowRight size={18}/></>}
        </button>
      </form>
      <button className="auth-reset" onClick={() => setMode(mode === "reset" ? "login" : "reset")}>
        {mode === "reset" ? "Back to login" : "Forgot your password?"}
      </button>
    </div>
  );
}
