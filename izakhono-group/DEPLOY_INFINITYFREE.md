# IZAKHONO AFRICA — InfinityFree Deployment Runbook

This folder is intentionally dependency-free and ready for InfinityFree. Upload the **contents** of `izakhono-group/` into the hosting account's `htdocs/` directory.

## Files required at launch
- `index.html`
- `styles.css`
- `script.js`

`DEPLOY_INFINITYFREE.md` itself does not need to be uploaded.

## Safe migration order
1. Create the InfinityFree hosting account/site and attach the intended Izakhono domain.
2. Upload `index.html`, `styles.css`, and `script.js` to `htdocs/` using the InfinityFree file manager or FTP.
3. Open the temporary InfinityFree URL and verify desktop/mobile layout, WhatsApp link, email link and navigation.
4. Enable/verify SSL for the custom domain.
5. Only after the temporary site passes checks, update the domain DNS/nameservers as instructed by InfinityFree.
6. Keep the old host intact until DNS propagation is complete and the custom domain serves the new site over HTTPS.
7. After cutover, verify: homepage, mobile menu, contact links, SSL, www/non-www behavior and search metadata.

## Rollback
If the custom domain does not resolve correctly after DNS changes, restore the previous DNS records/nameservers. Do not cancel the previous hosting account until the new site has been stable for at least 48 hours.

## Architecture note
InfinityFree is being used only for the public corporate/group website. Full application platforms that require Node.js, server-side APIs, realtime services, payments, authentication or background jobs remain on appropriate application infrastructure.
