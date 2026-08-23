import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCircuitBreaker } from '../src/shadow/circuit-breaker.mjs';
const policy={circuit_breaker:{max_consecutive_provider_failures:3,max_consecutive_data_quality_failures:2,halt_on_ledger_integrity_failure:true,cooldown_seconds:3600}};
test('halts immediately on ledger failure',()=>{const r=evaluateCircuitBreaker({cycle:{ledger_valid:false},policy,now:new Date('2026-08-23T20:00:00Z')}); assert.equal(r.allow_cycle,false); assert.equal(r.reason,'ledger_integrity_failure');});
test('halts after repeated data quality failure',()=>{let s={}; let r=evaluateCircuitBreaker({state:s,cycle:{provider_ok:true,data_quality_ok:false,ledger_valid:true},policy,now:new Date('2026-08-23T20:00:00Z')}); s=r.state; assert.equal(r.allow_cycle,true); r=evaluateCircuitBreaker({state:s,cycle:{provider_ok:true,data_quality_ok:false,ledger_valid:true},policy,now:new Date('2026-08-23T20:01:00Z')}); assert.equal(r.allow_cycle,false); assert.equal(r.reason,'data_quality_failure_threshold');});
