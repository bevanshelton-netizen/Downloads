import { validateActivationEnv } from '../src/activation/config.mjs';

const report = validateActivationEnv(process.env);
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 2);
