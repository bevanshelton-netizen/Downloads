import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
export default async function ProjectsPage(){
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) return null;
 const {data:memberships}=await supabase.from('tenant_members').select('tenant_id').eq('user_id',user.id).limit(1);
 const tenantId=memberships?.[0]?.tenant_id;
 const {data:projects}=tenantId ? await supabase.from('projects').select('id,name,slug,template_key,status,updated_at').eq('tenant_id',tenantId).order('updated_at',{ascending:false}) : {data:[]};
 return <main className='mx-auto max-w-6xl px-6 py-12'>
  <div className='flex items-center justify-between gap-4'><div><h1 className='text-3xl font-bold'>Website projects</h1><p className='mt-2 text-slate-600'>Build controlled, template-based websites for your organisation.</p></div><Link href='/dashboard/projects/new' className='rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white'>Create website</Link></div>
  <div className='mt-8 grid gap-4'>{(projects??[]).length===0?<div className='rounded-2xl border p-8'><p className='font-medium'>No website projects yet.</p><p className='mt-2 text-sm text-slate-600'>Create your first managed website.</p></div>:(projects??[]).map((p:any)=><Link key={p.id} href={`/dashboard/projects/${p.id}`} className='rounded-2xl border p-6 hover:bg-slate-50'><div className='flex items-center justify-between'><div><h2 className='text-xl font-semibold'>{p.name}</h2><p className='mt-1 text-sm text-slate-500'>{p.slug} · {p.template_key}</p></div><span className='rounded-full border px-3 py-1 text-sm capitalize'>{p.status}</span></div></Link>)}</div>
 </main>
}
