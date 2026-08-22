'use server';

import {redirect} from 'next/navigation';
import {revalidatePath} from 'next/cache';
import {createClient} from '@/lib/supabase/server';
import {createAdminClient} from '@/lib/supabase/admin';

async function requireStaff(){
 const s=await createClient();
 const{data:{user}}=await s.auth.getUser();
 if(!user)redirect('/login');
 const{data:p}=await s.from('profiles').select('role').eq('id',user.id).maybeSingle();
 if(!p||!['moderator','admin'].includes(p.role))redirect('/');
}

function settlementInput(fd:FormData){
 const creatorId=String(fd.get('creator_id')||'').trim()||null;
 const sharePct=Number(fd.get('artist_share_percent')??90);
 const holdHours=Number(fd.get('settlement_hold_hours')??48);
 if(!Number.isFinite(sharePct)||sharePct<0||sharePct>90||!Number.isInteger(holdHours)||holdHours<0||holdHours>720)redirect('/admin/tickets?error=Settlement%20share%20must%20be%200-90%25%20and%20hold%200-720%20hours');
 return{creatorId,shareBps:creatorId?Math.round(sharePct*100):0,holdHours};
}

async function verifyBeneficiary(admin:ReturnType<typeof createAdminClient>,creatorId:string|null){
 if(!creatorId)return null;
 const{data:creator,error}=await admin.from('creators').select('id,owner_id,name').eq('id',creatorId).maybeSingle();
 if(error||!creator)redirect('/admin/tickets?error=Select%20a%20valid%20artist%20or%20promoter%20account');
 const{data:wallet}=await admin.from('wallets').select('id').eq('owner_id',creator.owner_id).maybeSingle();
 if(!wallet)redirect('/admin/tickets?error=The%20selected%20beneficiary%20does%20not%20have%20a%20KORA%20wallet');
 return creator;
}

export async function createTicketEvent(fd:FormData){
 await requireStaff();
 const title=String(fd.get('title')||'').trim(),slug=String(fd.get('slug')||'').trim().toLowerCase(),description=String(fd.get('description')||'').trim(),start=String(fd.get('starts_at')||''),mode=String(fd.get('event_mode')||''),price=Number(fd.get('price')),capacity=Number(fd.get('capacity'));
 if(title.length<2||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||description.length<40||!start||!['venue','online','hybrid'].includes(mode)||!Number.isFinite(price)||price<0||!Number.isInteger(capacity)||capacity<1)redirect('/admin/tickets?error=Complete%20all%20event%20and%20tier%20fields');
 const settlement=settlementInput(fd);const a=createAdminClient();await verifyBeneficiary(a,settlement.creatorId);
 const e=await a.from('ticket_events').insert({title,slug,description,starts_at:new Date(start).toISOString(),venue_name:String(fd.get('venue_name')||'').trim()||null,venue_city:String(fd.get('venue_city')||'').trim()||null,event_mode:mode,status:'draft',sales_enabled:false,creator_id:settlement.creatorId,artist_share_bps:settlement.shareBps,settlement_hold_hours:settlement.holdHours}).select('id').single();
 if(e.error||!e.data)redirect(`/admin/tickets?error=${encodeURIComponent(e.error?.message||'Event creation failed')}`);
 const t=await a.from('ticket_tiers').insert({event_id:e.data.id,name:String(fd.get('tier_name')||'General').trim(),price,capacity});
 if(t.error)redirect(`/admin/tickets?error=${encodeURIComponent(t.error.message)}`);
 revalidatePath('/admin/tickets');
}

export async function configureTicketSettlement(fd:FormData){
 await requireStaff();
 const id=String(fd.get('event_id')||'');if(!id)return;
 const settlement=settlementInput(fd);const a=createAdminClient();
 const{data:event}=await a.from('ticket_events').select('sales_enabled').eq('id',id).maybeSingle();
 if(!event)redirect('/admin/tickets?error=Ticket%20event%20not%20found');
 if(event.sales_enabled)redirect('/admin/tickets?error=Lock%20ticket%20sales%20before%20changing%20the%20settlement%20agreement');
 await verifyBeneficiary(a,settlement.creatorId);
 const{error}=await a.from('ticket_events').update({creator_id:settlement.creatorId,artist_share_bps:settlement.shareBps,settlement_hold_hours:settlement.holdHours,updated_at:new Date().toISOString()}).eq('id',id);
 if(error)redirect(`/admin/tickets?error=${encodeURIComponent(error.message)}`);
 revalidatePath('/admin/tickets');revalidatePath('/admin/payouts');
}

export async function publishTicketPreview(fd:FormData){
 await requireStaff();const id=String(fd.get('event_id')||'');const a=createAdminClient();
 await a.from('ticket_events').update({status:'published',sales_enabled:false,updated_at:new Date().toISOString()}).eq('id',id);
 revalidatePath('/admin/tickets');revalidatePath('/tickets');
}

export async function setTicketSales(fd:FormData){
 await requireStaff();
 const id=String(fd.get('event_id')||''),enabled=String(fd.get('enabled'))==='true',mode=process.env.KORA_TICKET_CHECKOUT_MODE||'off';
 if(enabled&&mode==='off')redirect('/admin/tickets?error=Ticket%20checkout%20mode%20is%20off');
 if(enabled&&mode==='live'&&(process.env.PAYFAST_SANDBOX!=='false'||process.env.KORA_TICKET_LIVE_APPROVED!=='true'))redirect('/admin/tickets?error=Live%20PayFast%20and%20ticket%20approval%20are%20required');
 const a=createAdminClient();
 if(enabled){
  const{data:event}=await a.from('ticket_events').select('creator_id,artist_share_bps,status').eq('id',id).maybeSingle();
  if(!event||event.status!=='published')redirect('/admin/tickets?error=Publish%20the%20event%20preview%20before%20opening%20sales');
  if(Number(event.artist_share_bps)>0&&!event.creator_id)redirect('/admin/tickets?error=Configure%20the%20artist%20or%20promoter%20settlement%20account%20before%20opening%20sales');
  if(event.creator_id)await verifyBeneficiary(a,event.creator_id);
 }
 const{error}=await a.from('ticket_events').update({sales_enabled:enabled,updated_at:new Date().toISOString()}).eq('id',id).eq('status','published');
 if(error)redirect(`/admin/tickets?error=${encodeURIComponent(error.message)}`);
 revalidatePath('/admin/tickets');revalidatePath('/tickets');
}
