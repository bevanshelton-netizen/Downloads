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
