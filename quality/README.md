# IZAKHONO Premium Product Standard

This is the portfolio-wide release contract for high-class IZAKHONO products.

## Non-negotiables

- **IZAKHONO-owned infrastructure is authoritative.**
- External infrastructure may provide scale, previews and failover, but is not the system of record.
- A product is not called live because a build succeeded. Public-live status requires independent HTTPS verification.
- Premium UX, accessibility, privacy, security and resilience are release requirements, not later polish.
- Media products must distinguish guide/proof assets from final broadcast masters.
- Child-facing products must keep purchases and personalised advertising out of the child experience.

The automated gate verifies the standing contract and product registry. Product-specific CI remains responsible for deeper checks such as rendering, payments, databases and domain cutover.


## Wave 3 — Production Excellence

Wave 3 turns the premium doctrine into release-enforced product quality.

The source gate now checks:

- responsive/mobile contracts and a 44px interaction baseline;
- visible keyboard focus, reduced-motion support and high-contrast compatibility;
- local asset integrity, image alt text, duplicate IDs and brand/visual landmarks;
- static HTML/CSS size budgets and third-party-origin budgets;
- security-header presence on owned public runtimes;
- IZAKHONO PAY loopback protection and IZAKHONO Domains fail-closed checkout;
- public-health matrix consistency with the sellable-rollout register.

The network health job runs after merges and on a six-hour schedule. It may require temporary external resilience routes to remain reachable, while unverified owned target hostnames stay observation-only. An owned hostname is promoted to a required probe only after the rollout register records it as `owned-public-verified`.

Visual regression is enforced as a deterministic visual-contract gate: brand landmarks, interaction primitives, responsive behaviour and asset contracts must remain intact. Pixel screenshot testing may supplement this later, but cannot weaken the deterministic gate.
