"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPassword(){
 const [email,setEmail]=useState("");
 const [message,setMessage]=useState("");
 async function submit(e:React.FormEvent){e.preventDefault();try{const result=await api<{ok:boolean;code?:string}>("/auth/forgot",{method:"POST",body:JSON.stringify({email})});setMessage(result.code?`Development reset code: ${result.code}`:"If an account exists, reset instructions were prepared.");}catch(err){setMessage(err instanceof Error?err.message:"Reset failed");}}
 return <main className="auth-shell forgot"><div className="auth-photo"/><section className="auth-panel"><form className="card" onSubmit={submit}><h1>Reset password</h1>{message&&<div className="panel">{message}</div>}<div className="field"><label>Registered email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div><button className="btn">Continue</button><div className="link-row"><Link href="/login">Back to login</Link></div></form></section></main>
}
