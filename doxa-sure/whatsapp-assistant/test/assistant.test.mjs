import assert from 'node:assert/strict';
import { buildReply, classifyIntent, extractIncomingMessages } from '../lib/assistant.mjs';

const cases = [
  ['hello', 'welcome'],
  ['1', 'home'],
  ['My bond is behind', 'home'],
  ['2', 'vehicle'],
  ['I am worried about repossession', 'vehicle'],
  ['3', 'income'],
  ['I lost my job', 'income'],
  ['4', 'legal'],
  ['I received a Section 129 notice', 'legal'],
  ['5', 'risk_result'],
  ['DOXA-SURE Free Asset Risk Check: RED — URGENT', 'risk_result'],
  ['6', 'pack'],
  ['R199 Rescue Readiness Pack', 'pack'],
  ['7', 'shield'],
  ['R99 Shield', 'shield'],
  ['8', 'human'],
  ['I want a human', 'human']
];

for (const [input, expected] of cases) {
  assert.equal(classifyIntent(input), expected, `${input} should classify as ${expected}`);
}

const critical = buildReply('I received summons and court papers');
assert.equal(critical.urgent, true);
assert.equal(critical.needsHuman, true);
assert.match(critical.reply, /Legal deadlines can continue to run/i);
assert.match(critical.reply, /qualified professional/i);

const sensitive = buildReply('Here is my banking password and pin 1234');
assert.equal(sensitive.intent, 'sensitive');
assert.match(sensitive.reply, /do not send passwords/i);

const pack = buildReply('PACK');
assert.match(pack.reply, /R199 once-off/i);
assert.match(pack.reply, /not insurance cover/i);
assert.match(pack.reply, /Do not send payment until/i);

const payload = {
  entry: [{
    changes: [{
      value: {
        messages: [{ id: 'wamid.123', from: '27660000000', timestamp: '1', type: 'text', text: { body: 'hello' } }]
      }
    }]
  }]
};
assert.deepEqual(extractIncomingMessages(payload), [{ id: 'wamid.123', from: '27660000000', text: 'hello', timestamp: '1' }]);
assert.deepEqual(extractIncomingMessages({ entry: [] }), []);

console.log('DOXA-SURE WhatsApp assistant tests passed');
