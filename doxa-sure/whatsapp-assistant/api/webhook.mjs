import crypto from 'node:crypto';
import { buildReply, extractIncomingMessages } from '../lib/assistant.mjs';

export const config = { api: { bodyParser: false } };

const seen = new Set();
const MAX_SEEN = 1000;

function remember(id) {
  if (seen.has(id)) return false;
  seen.add(id);
  if (seen.size > MAX_SEEN) seen.delete(seen.values().next().value);
  return true;
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function signatureIsValid(rawBody, signature, appSecret) {
  if (!signature || !appSecret) return false;
  const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function requiredEnv() {
  const keys = ['WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'META_APP_SECRET', 'META_GRAPH_VERSION'];
  const missing = keys.filter((k) => !process.env[k]);
  return { missing, ok: missing.length === 0 };
}

async function sendText(to, body) {
  const version = process.env.META_GRAPH_VERSION;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/${version}/${phoneId}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: String(body).slice(0, 4096) }
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp send failed (${response.status}): ${detail.slice(0, 500)}`);
  }
}

function safeLog(message, decision) {
  const senderHash = crypto.createHash('sha256').update(String(message.from)).digest('hex').slice(0, 12);
  console.info(JSON.stringify({ event: 'doxa_whatsapp_message', messageId: message.id, senderHash, intent: decision.intent, needsHuman: !!decision.needsHuman, urgent: !!decision.urgent }));
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'];
    const token = req.query?.['hub.verify_token'];
    const challenge = req.query?.['hub.challenge'];
    if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send('Verification failed');
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).send('Method not allowed');
    return;
  }

  const env = requiredEnv();
  if (!env.ok) {
    console.error(`Missing required environment variables: ${env.missing.join(', ')}`);
    res.status(503).json({ ok: false, error: 'Assistant is not configured' });
    return;
  }

  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['x-hub-signature-256'];
    if (!signatureIsValid(rawBody, signature, process.env.META_APP_SECRET)) {
      res.status(401).json({ ok: false, error: 'Invalid signature' });
      return;
    }

    const payload = JSON.parse(rawBody.toString('utf8') || '{}');
    const messages = extractIncomingMessages(payload);

    // Acknowledge valid webhook events quickly; message processing remains intentionally lightweight.
    for (const message of messages) {
      if (!remember(message.id)) continue;
      const decision = buildReply(message.text);
      safeLog(message, decision);
      await sendText(message.from, decision.reply);
    }

    res.status(200).json({ ok: true, processed: messages.length });
  } catch (error) {
    console.error('DOXA-SURE WhatsApp webhook error:', error instanceof Error ? error.message : String(error));
    // Return 200 after a valid delivery attempt only when safe to avoid an uncontrolled retry storm.
    res.status(500).json({ ok: false, error: 'Webhook processing failed' });
  }
}
