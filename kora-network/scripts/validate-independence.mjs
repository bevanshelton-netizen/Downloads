const required = [
  'edge', 'dns', 'cdn', 'web_runtime', 'api_gateway', 'media', 'storage',
  'data', 'identity', 'payments', 'analytics', 'observability', 'fortress', 'backup'
];

const verified = required.filter((engine) => process.env[`IZAKHONO_ENGINE_${engine.toUpperCase()}_VERIFIED`] === 'true');

console.log(`IZAKHONO independence: ${verified.length}/${required.length} required engines verified.`);

if (verified.length === required.length) {
  console.log('INDEPENDENCE_READY=true');
  process.exit(0);
}

const missing = required.filter((engine) => !verified.includes(engine));
console.log(`INDEPENDENCE_READY=false`);
console.log(`Missing verification: ${missing.join(', ')}`);

// This is a deployment verification gate, not a source-code build gate.
// CI may run it with no infrastructure secrets and should receive a clear,
// deterministic result rather than treating unconfigured infrastructure as live.
if (process.env.REQUIRE_INDEPENDENCE_VERIFICATION === 'true') process.exit(1);
