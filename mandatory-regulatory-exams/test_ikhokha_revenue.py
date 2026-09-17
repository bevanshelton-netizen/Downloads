#!/usr/bin/env python3
from pathlib import Path
import re, subprocess, sys

ROOT=Path(__file__).resolve().parent

def read(rel): return (ROOT/rel).read_text(encoding='utf-8')
def req(v,msg):
    if not v: raise SystemExit(msg)

lib=read('lib/ikhokha.js')
create=read('api/ikhokha/create-payment.js')
verify=read('api/ikhokha/verify.js')
webhook=read('api/ikhokha/webhook.js')
access=read('api/pdeready/access.js')
premium=read('pdeready/premium.html')
privacy=read('privacy.html')
terms=read('terms.html')
refunds=read('refunds.html')
success=read('pdeready/payment-success.html')

# Server-side product truth: browser cannot supply arbitrary amount.
for product, amount, days in [('pde4_launch','29900','90'),('pde5_launch','34900','90'),('pde_bundle','49900','120')]:
    req(product in lib, f'missing product {product}')
    req(f'amount: {amount}' in lib, f'wrong amount for {product}')
    req(f'days: {days}' in lib, f'wrong access days for {product}')
req('amount: product.amount' in create, 'create-payment must use server product amount')
req('productId' in create and 'PRODUCTS[productId]' in create, 'server product allowlist missing')
req('req.body.amount' not in create and 'body.amount' not in create, 'client amount must not control checkout')

# Credentials and signing stay server-side and fail closed.
req("process.env.IKHOKHA_APP_ID" in lib and "process.env.IKHOKHA_APP_SECRET" in lib, 'environment credentials missing')
req("createHmac('sha256'" in lib, 'HMAC-SHA256 signing missing')
req('IKHOKHA_NOT_CONFIGURED' in create and '503' in create, 'checkout must fail closed without credentials')
req("'IK-APPID'" in create and "'IK-SIGN'" in create, 'required iKhokha headers missing')
req('https://api.ikhokha.com/public-api/v1/api/payment' in lib, 'official create-payment endpoint missing')

# Callback and status verification controls.
req('incomingSignature !== expected' in webhook, 'webhook signature rejection missing')
req("incomingAppId !== appId" in webhook, 'webhook app id validation missing')
req('getStatus/external' in lib, 'external status endpoint missing')
req("providerStatus !== 'PAID'" in verify, 'paid-status gate missing')
req('Paid amount does not match' in verify, 'paid amount verification missing')
req('HttpOnly; Secure; SameSite=Lax' in verify, 'secure entitlement cookie flags missing')
req('verifyEntitlement' in access, 'premium room must verify entitlement')
req("Cache-Control', 'private, no-store" in access, 'premium room must not be cached publicly')

# Customer-facing checkout and policies.
for visible in ['R299','R349','R499','IZAKHONO AFRICA (PTY) LTD','iKhokha','Refund & cancellation']:
    req(visible in premium, f'checkout missing {visible}')
req('Payment-card details' in privacy and 'iKhokha' in privacy, 'privacy notice missing payment handling')
req('Paid access and merchant' in terms and 'IZAKHONO AFRICA (PTY) LTD' in terms, 'terms missing merchant/payment terms')
req('Duplicate or erroneous payments' in refunds, 'refund policy missing duplicate payment handling')
req('Do not pay again' in success, 'success page must protect against duplicate payment')

# Syntax-check every server-side function with Node.
js_files=[ROOT/'lib/ikhokha.js',ROOT/'api/ikhokha/config.js',ROOT/'api/ikhokha/create-payment.js',ROOT/'api/ikhokha/verify.js',ROOT/'api/ikhokha/webhook.js',ROOT/'api/pdeready/access.js']
for f in js_files:
    p=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
    req(p.returncode==0, f'node syntax failed for {f.name}: {p.stderr}')

print('IKHOKHA REVENUE GATE PASS: server pricing, HMAC signing, verification, entitlement, policies and JS syntax')
