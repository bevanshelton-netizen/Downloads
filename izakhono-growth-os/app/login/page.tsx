"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function GrowthLogin(){
  const router=useRouter();
  const [form,setForm]=useState({email:"",password:"",totp:""});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [mfa,setMfa]=useState(false);

  async function submit(event:FormEvent){
    event.preventDefault();
    setBusy(true);
    setError("");
    try{
      const response=await fetch("/api/auth/login",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify(form)
      });
      const payload=await response.json();
      if(!response.ok){
        if(payload?.code==="MFA_REQUIRED") setMfa(true);
        setError(payload?.error || "Sign-in failed.");
        return;
      }
      router.push("/");
      router.refresh();
    }catch{
      setError("Owner authentication service is unavailable.");
    }finally{
      setBusy(false);
    }
  }

  return <main className="loginPage">
    <section className="loginCard">
      <Link className="loginBack" href="/">← Growth OS</Link>
      <span className="kicker">IZAKHONO AUTH NODE</span>
      <h1>Owner access</h1>
      <p>Sign in through IZAKHONO-owned authentication. Credentials are forwarded server-side; the session is stored only in an HttpOnly cookie.</p>
      <form onSubmit={submit}>
        <label>Email<input type="email" autoComplete="username" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
        <label>Password<input type="password" autoComplete="current-password" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>
        {mfa&&<label>Authenticator code<input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.totp} onChange={e=>setForm({...form,totp:e.target.value.replace(/\D/g,"")})}/></label>}
        {error&&<div className="loginError">{error}</div>}
        <button className="primary loginSubmit" disabled={busy}>{busy?"Signing in…":"Secure sign in"}</button>
      </form>
      <small>Owner sessions are HttpOnly, SameSite protected, and permission checked before Growth OS reads or writes owned data.</small>
    </section>
  </main>;
}
