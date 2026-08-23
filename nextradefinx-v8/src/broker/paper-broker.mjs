import { randomUUID } from 'node:crypto';
import { assertExecutionMode } from '../execution/execution-firewall.mjs';
export class PaperBroker {
  constructor({ slippageBps=1 }={}) { this.slippageBps=slippageBps; }
  async placeOrder(intent) {
    assertExecutionMode(intent.account_mode);
    const base=intent.order_type==='LIMIT' ? intent.limit_price : intent.reference_price;
    const direction=intent.side==='BUY' ? 1 : -1;
    const fill=Number(base)*(1+direction*this.slippageBps/10000);
    return { fill_id:randomUUID(), broker:'paper', status:'FILLED', symbol:intent.symbol, side:intent.side, quantity:intent.quantity, fill_price:Number(fill.toFixed(8)), filled_at:new Date().toISOString(), execution_enabled:false, simulated:true };
  }
}
