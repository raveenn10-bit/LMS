import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel">
        <Link href="/" className="auth-logo"><img src="/logo.svg" alt="Lavindu Maneth Mathematics"/></Link>
        <div>
          <span className="eyebrow">YOUR PERSONAL MATHS CLASSROOM</span>
          <h2>Clear concepts.<br/><em>Confident futures.</em></h2>
          <p>Live classes, recordings, notes and progress—organized in one secure learning space.</p>
        </div>
        <small>Lavindu Maneth · Mathematics</small>
      </section>
      <section className="auth-form-panel"><AuthForm/></section>
    </main>
  );
}
