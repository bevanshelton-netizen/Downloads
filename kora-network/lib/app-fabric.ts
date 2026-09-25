const OWNED_DEFAULT='https://fabric.izakhonoafrica.co.za';
const EXTERNAL_BRIDGE='https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-gateway-event';
const PRODUCT_ORIGIN='https://kora.izakhonoafrica.co.za';

const clean=(value:unknown,max=500)=>String(value??'').trim().slice(0,max);

async function post(url:string,body:Record<string,unknown>,headers:Record<string,string>={},timeoutMs=2200){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{
      method:'POST',
      headers:{'content-type':'application/json',...headers},
      body:JSON.stringify(body),
      signal:controller.signal,
      cache:'no-store',
    });
    const data=await response.json().catch(()=>({}));
    if(response.ok||response.status===202)return {ok:true,status:response.status,...data};
    return {ok:false,status:response.status,error:(data as any)?.error||'APP FABRIC rejected event'};
  }catch(error:any){
    return {ok:false,status:null,error:error?.name==='AbortError'?'timeout':String(error?.message||error)};
  }finally{clearTimeout(timer)}
}

export async function emitKoraLead(input:{
  subjectRef:string;
  name:string;
  email?:string|null;
  phone?:string|null;
  company?:string|null;
  role?:string|null;
  source:string;
  title:string;
  note?:string|null;
  value?:number|null;
  platformId?:'kora'|'kora-gospel-tv'|'kora-kids'|'kora-cinema';
}){
  const body={
    platform_id:input.platformId||'kora',
    event_type:'lead.created',
    subject_ref:clean(input.subjectRef,180),
    contact:{
      name:clean(input.name,200),
      email:clean(input.email,320).toLowerCase(),
      phone:clean(input.phone,80),
      company:clean(input.company,200),
      role:clean(input.role,120),
      source:clean(input.source,120),
    },
    opportunity:{
      title:clean(input.title,240),
      value:Number.isFinite(Number(input.value))?Number(input.value):0,
      currency:'ZAR',
      source:clean(input.source,120),
    },
    note:clean(input.note,1000),
  };
  if(!body.subject_ref||(!body.contact.name&&!body.contact.email&&!body.contact.phone&&!body.contact.company)){
    return {ok:false,route:'invalid',error:'APP FABRIC lead requires a subject and commercial contact'};
  }

  const owned=clean(process.env.IZAKHONO_FABRIC_URL||OWNED_DEFAULT,500).replace(/\/$/,'');
  const token=clean(process.env.IZAKHONO_FABRIC_INTERNAL_TOKEN,1000);
  const primary=token
    ? await post(owned+'/api/fabric/event',body,{authorization:'Bearer '+token})
    : await post(owned+'/api/fabric/intake',body,{origin:PRODUCT_ORIGIN});

  if(primary.ok)return {...primary,route:'owned-primary'};
  const external=await post(EXTERNAL_BRIDGE,{...body,fabric_bridge:true},{origin:'https://kora-network.vercel.app'},3500);
  if(external.ok)return {...external,route:'external-resilience',primary_error:primary.error};
  return {ok:false,route:'unavailable',primary_error:primary.error,external_error:external.error};
}
