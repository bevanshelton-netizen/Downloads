import assert from 'node:assert/strict';
import handler from './contact.js';

function response(){
  return {
    statusCode:200,
    body:null,
    status(code){this.statusCode=code;return this},
    json(value){this.body=value;return this}
  };
}

const base={name:'Test Sender',organisation:'Test Org',email:'sender@example.com',interest:'General enquiry',message:'Hello'};

let req={method:'GET',body:{}};
let res=response();
await handler(req,res);
assert.equal(res.statusCode,405);

req={method:'POST',body:{name:'',email:'sender@example.com',message:''}};
res=response();
await handler(req,res);
assert.equal(res.statusCode,400);

req={method:'POST',body:{...base,website:'bot'}};
res=response();
await handler(req,res);
assert.equal(res.statusCode,200);
assert.equal(res.body.ok,true);

const originalFetch=globalThis.fetch;
try {
  let calls=[];
  globalThis.fetch=async (url,options)=>{
    calls.push({url,options});
    return new Response(JSON.stringify({ok:true,delivery_claim:'accepted',outbox:{id:'test-outbox-1'}}),{status:200,headers:{'content-type':'application/json'}});
  };
  process.env.MAIL_TO='info@example.com';
  process.env.IZAKHONO_MAIL_API_URL='https://mail.example.com/';
  process.env.IZAKHONO_MAIL_API_TOKEN='test-token';
  delete process.env.RESEND_API_KEY;
  req={method:'POST',body:base};
  res=response();
  await handler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.provider,'izakhono-mail');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'https://mail.example.com/v1/send');
  assert.match(calls[0].options.headers.Authorization,/Bearer test-token/);

  calls=[];
  globalThis.fetch=async (url)=>{
    calls.push(url);
    if(url.includes('/v1/send')) return new Response('{}',{status:503});
    return new Response(JSON.stringify({id:'resend-test'}),{status:200,headers:{'content-type':'application/json'}});
  };
  process.env.RESEND_API_KEY='test-resend-key';
  req={method:'POST',body:base};
  res=response();
  await handler(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.provider,'resend');
  assert.equal(calls.length,2);
  assert.equal(calls[1],'https://api.resend.com/emails');
} finally {
  globalThis.fetch=originalFetch;
  delete process.env.MAIL_TO;
  delete process.env.IZAKHONO_MAIL_API_URL;
  delete process.env.IZAKHONO_MAIL_API_TOKEN;
  delete process.env.RESEND_API_KEY;
}

console.log('XQWAXQWAMILE contact API tests passed');
