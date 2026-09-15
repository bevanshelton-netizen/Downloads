# IZAKHONO OWNED CLOUD — Final Deployment Gates

## Software completion

The repository contains the thirteen-service owned stack:

1. DATA NODE
2. RUNTIME NODE
3. EDGE NODE
4. OBJECT NODE
5. QUEUE NODE
6. AUTH NODE
7. ANALYTICS NODE
8. NOTIFY NODE
9. AI GATEWAY NODE
10. CODE NODE
11. BACKUP NODE
12. CI WORKER NODE
13. REPLICA NODE

## Deployment states

### SOURCE_COMPLETE

All source, installers and CI gates are green and merged.

### PRIMARY_NODE_PROVED

Reached only after deploy-primary-node.sh runs successfully on an IZAKHONO-controlled Linux host and first-host-proof.sh passes:

- all private services healthy;
- CI WORKER reports production systemd mode;
- transient systemd build sandbox proof passes;
- infrastructure secrets are unreadable inside that sandbox;
- no external default route exists in the network-disabled proof unit;
- encrypted BACKUP snapshot completes;
- authenticated-decryption + SHA verification passes;
- source migration points deployment at IZAKHONO CODE.

### PUBLIC_EDGE_READY

Reached only when real TLS material exists, EDGE NODE is healthy and public DNS points the intended hostname to the controlled ingress.

No source-level test can truthfully substitute for DNS ownership, certificate issuance or public reachability.

### PHYSICAL_REPLICA_READY

Reached only when REPLICA NODE is running on a physically separate machine/site and a real encrypted .izbk archive has been transferred and independently verified there.

A second process on the same CI runner is a protocol proof, not disaster recovery.

## External realities that remain external

Even a fully owned software stack still depends on physical hardware, disks, power, upstream internet connectivity, domain registration, certificate trust and—where needed—large-scale upstream DDoS capacity.

Those are infrastructure inputs, not hidden hosted-software dependencies.
