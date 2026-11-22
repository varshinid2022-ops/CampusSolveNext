"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await api<{token:string; user:unknown}>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      localStorage.setItem("campussolve_token", result.token);
      localStorage.setItem("campussolve_user", JSON.stringify(result.user));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-photo" />
      <section className="auth-panel">
        <form className="card" onSubmit={submit}>
          <h1>Welcome back</h1>
          <p className="muted">Sign in to continue to CampusSolve.</p>
          {error && <div className="error">{error}</div>}
          <div className="field"><label>Email or username</label><input value={identifier} onChange={e=>setIdentifier(e.target.value)} required /></div>
          <div className="field"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
          <button className="btn" type="submit">Sign in</button>
          <div className="link-row"><Link href="/register">Create an account</Link></div>
        </form>
      </section>
    </main>
  );
}
