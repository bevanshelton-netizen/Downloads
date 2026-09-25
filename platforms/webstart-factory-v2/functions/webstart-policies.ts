const docs = {
terms: {
 title:"Terms & Conditions",
 body:`
<h2>1. Merchant and service provider</h2>
<p>IZAKHONO WebStart is operated by <strong>IZAKHONO AFRICA (PTY) LTD</strong>, registration number <strong>2022/699539/07</strong>, South Africa. IZAKHONO AFRICA is the contracting merchant for WebStart website-building, hosting and related digital services.</p>
<h2>2. The service</h2>
<p>WebStart allows customers to create, configure, generate, publish and manage business websites. Features may include templates, smart copy drafting, file uploads, hosted website addresses, payment integration and optional domain services.</p>
<h2>3. Customer responsibilities</h2>
<p>You must provide accurate business information and only upload content, logos, images and other material that you are entitled to use. You remain responsible for the legality, accuracy and claims made on your published website.</p>
<h2>4. Accounts and security</h2>
<p>You are responsible for keeping your login credentials secure and for activity carried out through your account. Notify IZAKHONO promptly if you believe your account has been compromised.</p>
<h2>5. Fees</h2>
<p>Current package prices are shown before checkout. Once live payment processing is enabled, payment may be handled by an approved third-party payment provider such as iKhokha. Optional custom domains, premium services or third-party services may carry separate charges that will be disclosed before purchase.</p>
<h2>6. Hosted addresses and availability</h2>
<p>A WebStart-hosted address may be provided without a separate domain purchase. While reasonable steps are taken to keep the platform available, uninterrupted operation cannot be guaranteed where outages or third-party infrastructure failures occur.</p>
<h2>7. Intellectual property</h2>
<p>You retain rights in the original business content and materials you provide. IZAKHONO retains rights in the WebStart platform, underlying software, templates, systems and reusable components. Your generated website may use those reusable components under the WebStart service licence.</p>
<h2>8. Suspension and misuse</h2>
<p>IZAKHONO may suspend content or accounts used for unlawful activity, fraud, infringement, malware, abuse, impersonation or conduct that threatens the platform or other users.</p>
<h2>9. Consumer rights</h2>
<p>Nothing in these terms excludes rights that cannot lawfully be excluded under South African law, including applicable rights under the Consumer Protection Act.</p>
<h2>10. Changes</h2>
<p>These terms may be updated as the platform evolves. Material changes will be communicated through the platform where reasonably practical.</p>`
},
privacy: {
 title:"Privacy Policy",
 body:`
<h2>1. Responsible party</h2>
<p>IZAKHONO AFRICA (PTY) LTD operates WebStart and processes personal information needed to provide and secure the service.</p>
<h2>2. Information we process</h2>
<p>This can include account identifiers, email address, business contact details, website content, uploaded branding assets, order records, domain requests, security logs and technical usage information.</p>
<h2>3. Why we process information</h2>
<p>Information is processed to create and manage accounts, build and host websites, provide support, process or reconcile payments, prevent fraud and abuse, comply with legal obligations, and improve service reliability.</p>
<h2>4. Payments</h2>
<p>Where iKhokha or another payment provider is used, payment information may be processed by that provider under its own security and privacy controls. WebStart stores transaction references and payment-status information needed for reconciliation, but should not require customers to submit card details directly to WebStart.</p>
<h2>5. Sharing</h2>
<p>Information may be shared with infrastructure, hosting, storage, payment and communications providers only where needed to operate WebStart, meet legal duties or protect the service.</p>
<h2>6. Storage and security</h2>
<p>WebStart uses access controls and technical safeguards intended to restrict customer data to authorised users. No online service can guarantee absolute security.</p>
<h2>7. Retention</h2>
<p>Information is kept only for as long as reasonably necessary for service delivery, legitimate business records, dispute handling, security and legal obligations.</p>
<h2>8. Your rights</h2>
<p>Subject to applicable law, you may request access to, correction of, or appropriate deletion of personal information, and may object to or restrict certain processing where the law allows.</p>
<h2>9. POPIA</h2>
<p>WebStart is intended to be operated in accordance with the Protection of Personal Information Act 4 of 2013 (POPIA) and related South African data-protection requirements.</p>
<h2>10. Contact and complaints</h2>
<p>Privacy requests may be raised through the WebStart support channel. You may also approach the Information Regulator of South Africa where you believe your rights under POPIA have been infringed.</p>`
},
refund: {
 title:"Refund & Cancellation Policy",
 body:`
<h2>1. Overview</h2>
<p>WebStart combines automated digital services with setup, website generation and ongoing hosting. This policy is intended to be fair while preserving any non-waivable rights customers have under South African law.</p>
<h2>2. Before work or generation begins</h2>
<p>If a paid order is cancelled before website generation, configuration or other substantive work has begun, IZAKHONO will assess the request for a refund, less any unavoidable third-party transaction or service costs where legally permissible.</p>
<h2>3. After generation or custom work begins</h2>
<p>Once website generation, custom configuration, design work, domain work or another personalised digital service has begun, the setup component may no longer be fully refundable, subject always to applicable consumer law and the circumstances of the transaction.</p>
<h2>4. Recurring hosting</h2>
<p>A customer may request cancellation of future recurring hosting or service charges. Cancellation stops future service renewal after the applicable paid period, unless another arrangement is agreed.</p>
<h2>5. Service failure</h2>
<p>If WebStart fails to provide a paid service materially as agreed, IZAKHONO will first attempt to correct the problem. Where correction is not reasonably possible, an appropriate refund, credit or other remedy will be considered in line with applicable law.</p>
<h2>6. Direct marketing and statutory rights</h2>
<p>Where a transaction arises from direct marketing, statutory cooling-off rights may apply. Other cancellation or refund rights may also arise under the Consumer Protection Act or other applicable South African law. This policy does not remove those rights.</p>
<h2>7. Refund method</h2>
<p>Approved refunds are ordinarily returned using the original payment route where practical and may depend on payment-provider processing times.</p>`
}
};

function page(title:string, body:string){
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} | IZAKHONO WebStart</title><style>body{margin:0;background:#f5f8fb;color:#111827;font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.65}.top{background:#07101f;color:#fff;padding:18px max(5vw,24px);font-weight:900}.top span{color:#0bb3bf}.wrap{max-width:900px;margin:38px auto;background:#fff;border:1px solid #dfe6ed;border-radius:20px;padding:34px;box-shadow:0 14px 45px #11233b12}h1{font-size:clamp(2.2rem,5vw,4rem);line-height:1;letter-spacing:-.05em;margin-top:0}h2{margin-top:28px}p{color:#4f5e71}a{color:#077f89}.links{display:flex;gap:12px;flex-wrap:wrap;margin-top:32px}.links a{background:#e9f7f8;padding:10px 13px;border-radius:10px;text-decoration:none;font-weight:800}.note{background:#fff8e8;border-left:4px solid #d4af37;padding:14px;margin:20px 0;color:#624a0b}.foot{max-width:900px;margin:0 auto 40px;color:#6b7789;padding:0 20px;font-size:.9rem}</style></head><body><div class="top">IZAKHONO <span>WebStart</span></div><main class="wrap"><h1>${title}</h1><div class="note">Effective 12 September 2026. This is the WebStart operating policy and does not override rights granted by applicable law.</div>${body}<div class="links"><a href="?doc=terms">Terms</a><a href="?doc=privacy">Privacy</a><a href="?doc=refund">Refunds & Cancellations</a><a href="https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/webstart-app">Back to WebStart</a></div></main><div class="foot">IZAKHONO AFRICA (PTY) LTD · South Africa · WebStart</div></body></html>`;
}

Deno.serve((req:Request)=>{
 const u=new URL(req.url); const key=(u.searchParams.get("doc")||"terms").toLowerCase();
 const d=(docs as any)[key]||docs.terms;
 return new Response(page(d.title,d.body),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"public, max-age=300","x-content-type-options":"nosniff"}});
});