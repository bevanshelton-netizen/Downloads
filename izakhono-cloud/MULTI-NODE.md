# IZAKHONO CLOUD v1.6 — Multi-Node Enrollment

v1.6 introduces the first safe multi-node foundation for IZAKHONO CLOUD: each owner-controlled machine gets its own cryptographic identity and can be registered as a signed **candidate** node.

## Security model

- Every node creates an ED25519 private key locally.
- The private key never leaves that node.
- The exported enrollment bundle contains only the public key, signed descriptor and signature.
- The registry verifies the signature and derives the node id from the public-key fingerprint.
- A node must already have produced `READY` or `LOCAL_READY` before an enrollment bundle can be exported.
- `READY` means the local runtime proof passed; it does **not** by itself prove that the machine is independently reachable from the public internet.
- All v1.6 registrations are forced to `trust_state=candidate`, `schedulable=false` and `public_ready=false`.

## Why candidate-only first

Enrollment and workload scheduling are separate trust decisions. A signed identity proves that the same machine controls the corresponding private key; it does not prove network reliability, public HTTPS reachability, storage durability, backup integrity across machines or failover behavior.

v1.6 therefore does not implement remote root commands, automatic workload migration, replication or high-availability claims.

## Node-side flow

After the owner-hosted node has produced `READY` or `LOCAL_READY`:

```bash
sudo ./enroll-this-node.sh
```

The default enrollment bundle is written to:

```text
/root/izakhono-node-enrollment.json
```

The node's private identity remains under:

```text
/var/lib/izakhono-cloud/node/identity/private.pem
```

Do not copy or publish the private key.

## Registry-side flow

Copy only the enrollment JSON bundle to the registry/controller machine and run:

```bash
sudo ./register-node.sh /path/to/izakhono-node-enrollment.json
```

The verified candidate record is stored under:

```text
/var/lib/izakhono-cloud/registry/nodes/<node-id>/
```

List registered nodes with:

```bash
python3 ./multinode.py list
```

## Promotion gate for a later release

Before any node becomes schedulable or is allowed to carry a public production workload, IZAKHONO CLOUD still needs a separate promotion gate covering at least:

1. independent public HTTPS verification where public service is intended;
2. authenticated controller-to-node transport;
3. workload isolation and resource admission;
4. encrypted inter-node data transport;
5. replication/backup proof;
6. disconnect and recovery behavior;
7. rollback/failover proof on at least two real owner-controlled machines.

Until those gates exist and pass, v1.6 is a **secure enrollment foundation**, not a high-availability or distributed-production claim.
