const APP_SLUG="auto-ai";
const PRODUCTS=new Set(["vehicle-health-report","repair-second-opinion","used-car-buyer-check"]);

const txt=(v)=>String(v??"").trim();
const validEmail=(v)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(txt(v));

export function paymentsConfigured(){
  return Boolean(txt(process.env.IZAKHONO_PAY_URL)&&txt(process.env.IZAKHONO_PAY_API_KEY));
}

function gatewayOrigin(){
  const raw=txt(process.env.IZAKHONO_PAY_URL).replace(/\/$/,"");
  const key=txt(process.env.IZAKHONO_PAY_API_KEY);
  if(!raw||!key){
    const err=new Error("Secure iKhokha checkout is not configured on this AUTO AI deployment.");
    err.statusCode=503;
    throw err;
  }
  const url=new URL(raw);
  const local=url.protocol==="http:"&&["127.0.0.1","localhost","::1"].includes(url.hostname);
  if(url.protocol!=="https:"&&!local) throw Object.assign(new Error("IZAKHONO PAY must use HTTPS or owner-node loopback."),{statusCode:500});
  if(url.username||url.password||url.search||url.hash) throw Object.assign(new Error("Invalid IZAKHONO PAY origin."),{statusCode:500});
  return {origin:raw,key};
}

async function gatewayFetch(path,options={}){
  const {origin,key}=gatewayOrigin();
  const response=await fetch(origin+path,{
    ...options,
    headers:{
      Accept:"application/json",
      "x-izakhono-app":APP_SLUG,
      "x-izakhono-key":key,
      ...(options.body?{"Content-Type":"application/json"}:{}),
      ...(options.headers||{})
    },
    signal:AbortSignal.timeout(15000)
  });
  let data={};
  try{data=await response.json();}catch{}
  if(!response.ok){
    const err=new Error(data.error||"Secure payment service is temporarily unavailable.");
    err.statusCode=response.status>=500?502:400;
    throw err;
  }
  return data;
}

export async function createPayment(input={}){
  const product=txt(input.product).toLowerCase();
  const name=txt(input.name).replace(/\s+/g," ").slice(0,120);
  const email=txt(input.email).toLowerCase().slice(0,120);
  if(!PRODUCTS.has(product)) throw Object.assign(new Error("Unknown AUTO AI product."),{statusCode:400});
  if(name.length<2) throw Object.assign(new Error("Enter your name."),{statusCode:400});
  if(!validEmail(email)) throw Object.assign(new Error("Enter a valid email address."),{statusCode:400});

  const reference="autoai-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
  const data=await gatewayFetch("/api/v1/orders",{
    method:"POST",
    body:JSON.stringify({product_code:product,customer_name:name,customer_email:email,customer_reference:reference})
  });
  const order=data?.order;
  if(!order||!order.id||order.product_code!==product||order.currency!=="ZAR") throw Object.assign(new Error("Invalid payment response."),{statusCode:502});

  const method=txt(order.payment_method).toLowerCase();
  if(method==="ikhokha"){
    const redirect=txt(order.redirect_url);
    const target=new URL(redirect);
    if(target.protocol!=="https:") throw Object.assign(new Error("Unsafe checkout URL returned."),{statusCode:502});
    return {id:order.id,status:order.status,product_code:order.product_code,amount_minor:order.amount_minor,currency:order.currency,payment_method:"ikhokha",provider:"ikhokha",redirect_url:redirect};
  }
  if(method==="eft"){
    return {id:order.id,status:order.status,product_code:order.product_code,amount_minor:order.amount_minor,currency:order.currency,payment_method:"eft",provider:"eft",payment_reference:order.payment_reference,bank:order.bank,instructions:order.instructions};
  }
  throw Object.assign(new Error("Unsupported payment method returned."),{statusCode:502});
}

export async function paymentStatus(orderId){
  const id=txt(orderId);
  if(!/^izp_[A-Za-z0-9_-]{16,80}$/.test(id)) throw Object.assign(new Error("Invalid payment order."),{statusCode:400});
  const data=await gatewayFetch("/api/v1/orders/status?"+new URLSearchParams({order:id}),{method:"GET"});
  const order=data?.order;
  if(!order||order.id!==id) throw Object.assign(new Error("Payment order was not found."),{statusCode:404});
  return {id:order.id,status:order.status,product_code:order.product_code,amount_minor:order.amount_minor,currency:order.currency,provider:order.provider,provider_status:order.provider_status};
}

export async function requirePaid(orderId,product){
  const order=await paymentStatus(orderId);
  if(order.product_code!==product) throw Object.assign(new Error("Payment does not match this AUTO AI service."),{statusCode:402});
  if(order.status!=="paid") throw Object.assign(new Error("Payment is not confirmed yet."),{statusCode:402});
  return order;
}

export function sendError(res,error){
  const status=Number(error?.statusCode)||500;
  return res.status(status).json({error:status>=500&&status!==503?"Secure payment service is temporarily unavailable.":String(error?.message||"Request failed.")});
}
