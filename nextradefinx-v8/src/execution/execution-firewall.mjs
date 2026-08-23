export function assertExecutionMode(mode='practice') {
  if (mode !== 'practice') throw new Error('real_execution_not_implemented_v8');
  if (process.env.EXECUTION_ENABLED === 'true') throw new Error('v8_execution_firewall_refuses_live_execution');
  return { mode:'practice', execution_enabled:false, broker_orders_possible:false };
}
