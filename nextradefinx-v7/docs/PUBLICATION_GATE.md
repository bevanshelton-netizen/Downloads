# NexTradeFinX — Evidence Before Exposure

NexAI predictions must not become client-facing merely because a backtest or short shadow run looks good.

The V7 internal evidence gate requires all configured checks to pass simultaneously:

1. minimum observation days;
2. minimum total forecasts;
3. minimum directional calls;
4. Brier-score improvement versus a naive probability baseline;
5. acceptable calibration error;
6. a 95% Wilson lower bound for directional hit rate above the configured random baseline.

Passing the gate means **eligible for internal human review only**. It does not authorize a marketing claim, personalized financial advice or real-money execution. Those require separate model-risk, legal/compliance and regulated-partner approvals.
