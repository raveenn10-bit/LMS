import Link from "next/link";
import { AdminAuthForm } from "@/components/admin-auth-form";

export default function AdminLoginPage() {
  return <main className="auth-page admin-auth-page">
    <section className="auth-brand-panel admin-brand-panel">
      <Link href="/" className="auth-logo"><img src="/logo.svg" alt="Lavindu Maneth Mathematics"/></Link>
      <div>
        <span className="eyebrow">PRIVATE MANAGEMENT PORTAL</span>
        <h2>Manage classes.<br/><em>Guide progress.</em></h2>
        <p>Students, payments, lessons and announcements—managed from one protected workspace.</p>
      </div>
      <small>Lavindu Maneth · LMS Administration</small>
    </section>
    <section className="auth-form-panel"><AdminAuthForm/></section>
  </main>;
}
