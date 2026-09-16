# IZAKHONO PACKAGE NODE

Owned package-cache/mirror for IZAKHONO builds.

## V1 capabilities

- npm-registry compatible GET/HEAD proxy;
- upstream host pinned by server configuration;
- package metadata caching;
- tarball caching on owned disk;
- metadata tarball URLs rewritten to the owned mirror;
- SHA-256 checksums for cached bodies;
- conditional revalidation using ETag / Last-Modified;
- stale-cache fallback when upstream is unavailable;
- immutable-style long TTL for tarballs;
- object-size limits;
- cache stats and purge admin endpoints;
- loopback bind by default;
- SQLite WAL index;
- zero runtime npm dependencies.

## Use with npm

On an owned build worker:

    npm config set registry http://127.0.0.1:8900/

or set:

    npm_config_registry=http://127.0.0.1:8900/

The first request may still need the public upstream. Subsequent cached package metadata/tarballs come from owned storage.

## What this achieves

PACKAGE NODE reduces build dependence on public registry uptime and repeated downloads. It is a cache/mirror, not a claim that IZAKHONO owns third-party package copyrights.

Keep normal open-source licence obligations for packages you use or redistribute.

## Security

The proxy accepts GET and HEAD only. Cache administration requires `IZAKHONO_PACKAGE_KEY`. The service binds to loopback unless you deliberately place it behind a private network boundary.
