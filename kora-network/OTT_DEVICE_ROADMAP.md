# KORA TV — OTT Device Delivery Roadmap

## Mission
KORA TV is being built as an African-first, global-ready OTT platform. One content, identity, entitlement, advertising and analytics layer should serve web, mobile and TV endpoints.

## Device targets
- Web/PWA
- Android / Android TV
- Fire TV
- Apple TV
- Roku
- Chromecast / Cast-enabled TVs
- Smart-TV web runtimes (including VIDAA where commercially/technically supported)

## Platform layers
1. Content & channel catalogue
2. Live stream and VOD playback
3. Identity, profiles and parental controls
4. Entitlements: free, subscription, sponsorship and event access
5. Advertising: direct sponsor, house ads, FAST/AVOD inventory
6. Analytics: viewing, completion, device, geography and campaign metrics
7. Publishing API consumed by each client
8. Offline/low-connectivity strategy for supported content

## Device architecture rule
Do not fork business logic per device. Device clients consume shared contracts and APIs. UI is adapted to the interaction model of each device.

## Current implementation phase
The production web application is live. The multi-screen platform hub has been committed to the source repository. Deployment publication is gated by the current Vercel quota, so no deployment is claimed until independently verified.

## Next engineering gates
- Define stable OTT API contracts
- Add device capability registry
- Add playback entitlement model
- Add channel/EPG model
- Add sponsor/ad inventory model
- Build TV navigation and remote-control interaction patterns
- Establish deployment-independent packaging so KORA can move to IZAKHONO-owned infrastructure without rewriting product logic
