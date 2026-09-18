# IZAKHONO DNS NODE

Authoritative-only DNS for IZAKHONO-owned zones. It is deliberately not a recursive resolver.

Capabilities: UDP/TCP authoritative DNS; A, AAAA, CNAME, NS, SOA, MX, TXT and CAA records; authoritative NXDOMAIN/NODATA responses; loopback health/control; zone reload; low-privilege systemd service; zero runtime npm dependencies.

The safe first production use is the delegated child zone domains.izakhonoafrica.co.za. Moving the whole izakhonoafrica.co.za apex must wait until every existing mail, TXT verification, website and other DNS record has been imported and verified.

Files:
- /etc/izakhono/dns-zone.json
- /etc/izakhono/dns-node.env
- control health: http://127.0.0.1:8900/health

The installer starts on loopback port 5353. The owned-public-edge activation script moves it to authoritative port 53 only after writing a production zone.
