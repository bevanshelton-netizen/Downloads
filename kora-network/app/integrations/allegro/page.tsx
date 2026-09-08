'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

export default function AllegroIntegrationPage(){
  const[code,setCode]=useState('');
  const[message,setMessage]=useState('');
  const[saving,setSaving]=useState(false);

  async function submit(event:FormEvent){
    event.preventDefault();setSaving(true);setMessage('');
    const response=await fetch('/api/integrations/allegro/link',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({allegro_creator_ref:code.trim()})
    });
    const payload=await response.json().catch(()=>({}));
    setSaving(false);
    setMessage(response.ok?'ALLEGRO and KORA are linked for this creator account.':payload?.error||'Could not link creator accounts.');
  }

  return <main>
    <section className="subHero">
      <div className="eyebrow">KORA × ALLEGRO</div>
      <h1>Connect your creator identity.</h1>
      <p>Link once, then ALLEGRO can hand your rights-declared music videos, documentaries, concert films and Tour2Screen projects into your KORA Creator Studio.</p>
    </section>
    <section>
      <form className="panel formPanel" onSubmit={submit}>
        <label>ALLEGRO Creator Code<input value={code} onChange={e=>setCode(e.target.value)} minLength={8} required placeholder="Copy this from ALLEGRO Screen Studio"/></label>
        <p>This code identifies your ALLEGRO creator account. It is not your password and does not give KORA access to your ALLEGRO login.</p>
        {message?<p role="status">{message}</p>:null}
        <button className="primary" disabled={saving}>{saving?'Linking…':'Link ALLEGRO to KORA'}</button>
      </form>
      <div className="panel">
        <h3>What happens after linking?</h3>
        <p>ALLEGRO may create KORA draft screen projects for this creator reference. Every handoff remains subject to KORA rights review, moderation, access-model rules and production payment gates.</p>
        <div className="actions"><Link className="secondary" href="/studio">Open KORA Studio</Link><Link className="secondary" href="/tour2screen">Tour2Screen™</Link></div>
      </div>
    </section>
  </main>;
}
