"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({full_name:"",username:"",email:"",password:"",confirm:""});
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirm) return setError("Passwords do not match");
    if (form.password.length < 8) return setError("Password must contain at least 8 characters");
    try {
      const result = await api<{token:string; user:unknown}>("/auth/register", {
        method:"POST", body:JSON.stringify(form),
      });
      localStorage.setItem("campussolve_token", result.token);
      localStorage.setItem("campussolve_user", JSON.stringify(result.user));
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  }

  function update(key:string, value:string) { setForm(current => ({...current,[key]:value})); }
  return (
    <main className="auth-shell register">
      <div className="auth-photo" />
      <section className="auth-panel">
        <form className="card" onSubmit={submit}>
          <h1>Create your account</h1>
          {error && <div className="error">{error}</div>}
          {(["full_name","username","email"] as const).map(key => (
            <div className="field" key={key}><label>{key.replace("_"," ")}</label><input value={form[key]} onChange={e=>update(key,e.target.value)} required /></div>
          ))}
          <div className="field"><label>Password</label><input type="password" value={form.password} onChange={e=>update("password",e.target.value)} required /></div>
          <div className="field"><label>Confirm password</label><input type="password" value={form.confirm} onChange={e=>update("confirm",e.target.value)} required /></div>
          <button className="btn" type="submit">Create account</button>
          <div className="link-row"><Link href="/login">Already have an account? Sign in</Link></div>
        </form>
      </section>
    </main>
  );
}
