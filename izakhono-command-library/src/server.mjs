import http from "node:http";
import { URL } from "node:url";
import { COMMANDS, getCommand, listCommands } from "./registry.mjs";
import { expandCommandInput } from "./engine.mjs";

const port = Number(process.env.PORT || 8788);
const host = process.env.HOST || "0.0.0.0";
const maxBody = 65_536;
const allowedOrigins = new Set(
  String(process.env.IZAKHONO_COMMAND_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || "/", "http://command.local");
  const origin = req.headers.origin || "";

  if (!allowOrigin(origin, res)) {
    return json(res, 403, { error: "Origin is not allowed." });
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600"
    });
    return res.end();
  }

  try {
    if (req.method === "GET" && requestUrl.pathname === "/healthz") {
      return json(res, 200, {
        status: "ok",
        service: "izakhono-command-library",
        version: 1,
        commands: COMMANDS.length
      });
    }

    if (req.method === "GET" && requestUrl.pathname === "/v1/commands") {
      const category = requestUrl.searchParams.get("category") || undefined;
      return json(res, 200, {
        version: 1,
        commands: listCommands({ category }).map(publicCommand)
      });
    }

    if (req.method === "GET" && requestUrl.pathname.startsWith("/v1/commands/")) {
      const name = decodeURIComponent(requestUrl.pathname.slice("/v1/commands/".length));
      const command = getCommand(name);
      if (!command) return json(res, 404, { error: "Command not found." });
      return json(res, 200, { version: 1, command: publicCommand(command) });
    }

    if (req.method === "POST" && requestUrl.pathname === "/v1/expand") {
      const body = await readJson(req);
      if (typeof body.input !== "string") return json(res, 400, { error: "input must be a string." });
      const expanded = expandCommandInput(body.input, {
        context: body.context,
        language: body.language,
        platform: body.platform
      });
      return json(res, 200, expanded);
    }

    if (req.method === "GET" && requestUrl.pathname === "/") {
      return html(res, 200, landingPage());
    }

    return json(res, 404, { error: "Not found." });
  } catch (error) {
    const status = error?.code === "UNKNOWN_COMMAND" ? 400 : 400;
    return json(res, status, {
      error: error?.message || "Request failed.",
      suggestions: error?.suggestions || undefined
    });
  }
});

server.listen(port, host, () => {
  console.log(`IZAKHONO Command Library listening on http://${host}:${port}`);
});

function publicCommand(command) {
  return {
    id: command.id,
    aliases: command.aliases,
    category: command.category,
    summary: command.summary,
    verificationRequired: Boolean(command.verification)
  };
}

function allowOrigin(origin, res) {
  if (!origin) return true;
  if (!allowedOrigins.has(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  return true;
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  });
  res.end(body);
}

function html(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'self'"
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBody) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Body must be valid JSON.");
  }
}

function landingPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>IZAKHONO Command Library</title>
<style>
:root{font-family:Inter,system-ui,sans-serif;color:#eef7f1;background:#07130e}
body{margin:0;background:radial-gradient(circle at top,#123325 0,#07130e 55%);min-height:100vh}
main{max-width:980px;margin:auto;padding:48px 20px 80px}
.badge{display:inline-block;border:1px solid #5ecf91;border-radius:999px;padding:6px 12px;color:#8ff0b5;font-weight:700}
h1{font-size:clamp(2.4rem,7vw,5.3rem);line-height:.95;margin:24px 0 16px;letter-spacing:-.04em}
.lead{font-size:1.15rem;color:#b8c9c0;max-width:720px}
.card{background:#0c1d15;border:1px solid #214534;border-radius:20px;padding:20px;margin-top:28px}
textarea{width:100%;box-sizing:border-box;min-height:110px;border-radius:14px;border:1px solid #315844;background:#06110c;color:#fff;padding:16px;font:inherit}
button{margin-top:12px;border:0;border-radius:12px;background:#69e39d;color:#05200f;padding:12px 18px;font-weight:800;cursor:pointer}
pre{white-space:pre-wrap;word-break:break-word;background:#04100a;border-radius:12px;padding:16px;color:#cce9d8;min-height:70px}
#commands{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:18px}
.command{background:#10271b;border:1px solid #224b35;border-radius:12px;padding:12px}
.command b{color:#83eeae}.command small{display:block;color:#9eb5a7;margin-top:5px}
footer{margin-top:34px;color:#80978a;font-size:.9rem}
</style>
</head>
<body><main>
<span class="badge">IZAKHONO • OWNED-FIRST</span>
<h1>One command layer.<br>Every platform.</h1>
<p class="lead">Reusable slash commands for reasoning, operations, security, compliance, sales and growth. No behavioural tracking. No prompt logging. No model lock-in.</p>
<div class="card">
<label for="input"><b>Try a command chain</b></label>
<textarea id="input">/assumptions /risks /solution Launch this product to paying customers.</textarea>
<button id="run">Expand command</button>
<pre id="output">Ready.</pre>
</div>
<div id="commands"></div>
<footer>IZAKHONO AFRICA (PTY) LTD • Command Library v1 • External model providers are replaceable adapters.</footer>
<script>
const out=document.getElementById('output');
async function load(){
 const r=await fetch('/v1/commands'); const j=await r.json();
 document.getElementById('commands').innerHTML=j.commands.map(c=>'<div class="command"><b>/'+c.id+'</b><small>'+c.summary+'</small></div>').join('');
}
document.getElementById('run').onclick=async()=>{
 out.textContent='Expanding…';
 const r=await fetch('/v1/expand',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input:document.getElementById('input').value,platform:'Command Library'})});
 const j=await r.json(); out.textContent=j.instruction||j.error||JSON.stringify(j,null,2);
};
load().catch(e=>out.textContent=e.message);
</script>
</main></body></html>`;
}
