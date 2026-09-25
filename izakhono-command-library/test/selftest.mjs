import assert from "node:assert/strict";
import { COMMANDS, getCommand } from "../src/registry.mjs";
import { expandCommandInput, parseCommandInput, suggestCommands } from "../src/engine.mjs";

assert(COMMANDS.length >= 25, "Expected a broad portfolio command registry.");
assert.equal(getCommand("/riskcheck")?.id, "risks");
assert.equal(getCommand("ecd360")?.id, "ecd");

const parsed = parseCommandInput("/assumptions /risks /solution Launch the new service");
assert.deepEqual(parsed.commands.map((x) => x.id), ["assumptions", "risks", "solution"]);
assert.equal(parsed.subject, "Launch the new service");

const expanded = expandCommandInput("/factcheck The platform is live.", {
  platform: "ECD360",
  language: "English"
});
assert.equal(expanded.metadata.executedAction, false);
assert.equal(expanded.guardrails.noSilentAnalytics, true);
assert.match(expanded.instruction, /Never convert an unsupported claim into a fact/i);
assert.match(expanded.instruction, /Do not invent sources/i);
assert.match(expanded.instruction, /ECD360/);

const launch = expandCommandInput("/launch Publish the platform");
assert.match(launch.instruction, /public HTTPS/i);
assert.match(launch.instruction, /successful build/i);

const tax = expandCommandInput("/sars Calculate PAYE");
assert.match(tax.instruction, /official SARS/i);
assert.match(tax.instruction, /professional confirmation/i);

const fraud = expandCommandInput("/fraudcheck Review this transaction");
assert.match(fraud.instruction, /avoid declaring a person fraudulent/i);

assert(suggestCommands("riks").some((x) => x === "/risks"));

assert.throws(
  () => parseCommandInput("/definitelynotacommand test"),
  (error) => error.code === "UNKNOWN_COMMAND" && Array.isArray(error.suggestions)
);

assert.throws(() => parseCommandInput("x".repeat(20_001)), /exceeds/);

console.log(`PASS IZAKHONO Command Library v1 — ${COMMANDS.length} canonical commands`);
