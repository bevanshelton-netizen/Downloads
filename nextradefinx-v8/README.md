# NexTradeFinX V8 — Practice Trading & Execution Firewall

V8 adds the first trading workflow without allowing a real trade.

- typed practice-only order intent
- pre-trade risk calculation in account currency
- position-size and daily-loss limits
- paper broker with simulated fills
- explicit broker adapter interface for future licensed infrastructure
- execution firewall that rejects live modes and accidental live flags

The product can now teach a user what an order means, show how much can be lost if the stop is hit, and allow practice execution while real brokerage remains physically unavailable in code.
