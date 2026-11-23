# Isolated GPU deployment and rollback

## Current infrastructure

`valoprac.trade` is an existing public static Sites deployment. It serves Vite build output and cannot be assumed to run a GPU Unreal executable. Keep it in place. The private canonical Sites source branch continues to hold the frontend and migration sources. No account connections, domains, paid resources or billing changes were performed for this migration.

## Proposed staging topology

Use a separate authorized GPU host close to the player population (initial evaluation: Seoul). A session allocation starts **one Unreal application and one official signalling server** in a dedicated slot. `--max_players 1`, per-session environment ID, ephemeral private lease token, independent signalling ticket and one active WebSocket prevent two users sharing one application. More slots are disabled until GPU, VRAM, encoder and CPU load are measured. A high-capacity encoder alone does not imply multiple UE rendering instances fit the GPU.

The host-native broker runs without root under systemd. Caddy terminates HTTPS/WSS at `gpu-staging.valoprac.trade` and proxies to loopback port 4242. The ordinary web host serves the browser client and a native Sites identity-gated GPU admission endpoint. TURN is independently operated with short-lived credentials. Do not expose signalling ports 18080–18095, streamer ports 18880–18895 or SFU ports 19880–19895 publicly. Enforce this with the cloud firewall and host firewall; the official signalling process may listen on all interfaces. Only 443/TCP and the explicitly configured ICE/TURN ports should be open. Keep permanent TURN secrets in a protected environment/service configuration, never in Vite `VITE_` variables or public assets.

The `VALOPRAC_PEER_OPTIONS` environment value is written to a private temporary file with mode 0600 per worker, passed to Epic via `--peer_options_file`, then removed on teardown. Use ephemeral TURN credentials and rotate them for long sessions. The browser receives only the ICE credentials needed for its current session. Provision a real TURN deployment; this repository does not claim one is running.

The broker is staging infrastructure. In 2.2, pending startup holds its slot until every child stops; cancellation aborts the readiness probe, failed termination quarantines capacity, and process-group cleanup is exercised with disposable Node processes. These fixtures do not prove actual Unreal startup or GPU release. Direct callers cannot select their rate-limit identity through forwarded headers. Host/namespace hardening, adversarial allocation abuse, production auth/rate policies, regional autoscaling, TURN credential renewal, admission queues and provider quota handling require infrastructure QA before public streaming rollout. Each lease is process-isolated; slots are **not** security sandboxes for untrusted binaries. Default capacity is one. Idle/failed leases expire after 90 seconds without heartbeats; Approved Free Practice can continue without restarting the engine, but GPU authorization expires after 15 minutes unless a fresh, one-use grant from the same currently approved Sites identity renews it. The browser rechecks admission every five minutes; heartbeat alone cannot extend authorization. UE pauses input after three seconds without valid application pings, so a lost WebRTC channel does not leave a weapon firing.

## Bring-up after authorization

1. Obtain user authorization for the cloud account, region and budget. Establish Unreal entitlement and a UE5.7 build workstation. No credentials are requested in chat.
2. Build/cook/package UE using `scripts/build-unreal.sh`. Treat any UBT/API errors as blockers and fix them on that workstation.
3. Provision a GPU host with functioning Vulkan graphics driver and hardware encoder. An AWS `g4dn.xlarge` has one T4, four vCPUs and 16 GiB system RAM; its ability to run this project at target FPS has **not** been measured.
4. Copy only the approved packaged application and integration source to `/opt/valoprac`. Install Node 22+ and Caddy. Create a non-root `valoprac` service user and protected `/etc/valoprac/worker.env` based on the example.
5. Run `setup-infrastructure.sh` with an empty `VALOPRAC_INFRA_ROOT`; it checks out the exact official UE5.7 infrastructure commit and compiles Common, Signalling and SignallingWebServer.
6. Run the service, validate actual streamer readiness, TLS, TURN and ICE. `verify-ready.mjs` probes the official `listStreamers` protocol; no open-port-only readiness is accepted. Do not expose its probe as a second controlling player.
7. Test one session, then two authorized isolated instances. Prove a user's mouse, ammo, reset and reconnect cannot control another lease. Verify killed workers release their GPU/encoder sessions and sockets.
8. Complete every entry in `migration-gates.json`. Save engine package hash, driver, GPU, browser, display, region, network and recordings as evidence. Keep the current browser default. Enable staging only with a verified HTTPS allocator URL and exact WSS hostname allowlist.
9. Build and deploy the approved frontend through the existing Sites source workflow. Never put permanent cloud credentials in frontend bundles. Verify public release JSON and asset hashes from the custom domain.

## Cost evidence and capacity estimate

Primary AWS regional price-list CSV retrieved on **2026-10-18**: `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonEC2/current/ap-northeast-2/index.csv`.

The exact Linux/shared/on-demand/used-capacity `g4dn.xlarge` record is SKU `NPWTV4PDSKJ9WCNH`, effective `2026-10-01`, **USD 0.647 per instance-hour**. The extracted record is stored in `aws-price-evidence.json`. It is a published reference rate, not a quote including all costs.

Conservative planning assumes **one whole T4 instance per concurrent player** until profiling proves otherwise:

| Workload | GPU compute only | Nominal video at 15 Mbit/s |
|---|---:|---:|
| One player, 2 hours | $1.294 | 13.5 GB |
| One player, 60 hours/month | $38.82 | 405 GB |
| One instance always on, 730 hours/month | $472.31 | up to 4,927.5 GB |
| Ten simultaneous instances always on | $4,723.10 | up to 49,275 GB |

Traffic is `Mbit/s * 3600 / 8 / 1000 = GB/hour`. Rates exclude audio/protocol overhead, egress charges, TURN relay, idle warm-up time, disk, IP addresses, taxes and UE build machines. TURN may add another metered relay hop. Verify current region-specific egress rates and provider quotas before spending. A test budget needs a shutdown timer and a separately approved egress allowance. No cloud resources have been purchased or started.

## Safe promotion and rollback

The frontend build rejects enabled streaming while any migration gate is false. The existing browser renderer remains the default even after a staging endpoint is configured. Do not promote solely on screenshots or portable C++ unit tests.

The prior public baseline is saved Site version **4** (application 2.1.0), source `683be0cd1bbf4f867cb7f27d78ab548a1351fd9e`, exact saved version ID in `migration-gates.json`. Roll back by deploying that saved version through the existing Site project. Do not alter DNS for a frontend rollback. Stop the GPU broker to release processes, revoke session tickets and stop billed instances separately; a frontend rollback alone does not stop cloud billing. Normal engine outage fallback is the working **브라우저 훈련 시작** action.

## Admission configuration (required before any GPU rollout)

Keep `public/streaming-config.json` disabled until the migration gates and the following configuration are complete. Native browser training remains public and accountless.

- Generate a private key with at least 32 random bytes. Configure the SAME `VALOPRAC_GPU_GRANT_SECRET` privately in Sites runtime secrets and `/etc/valoprac/worker.env`. Never publish it, place it in `VITE_` variables, or embed it in the downloadable source.
- Set `VALOPRAC_GPU_ORIGIN` in Sites runtime to the exact public HTTPS origin used by the broker. No path or trailing slash.
- Set Sites runtime `VALOPRAC_GPU_ALLOWED_USERS` to the comma-separated native Sites user IDs of explicitly approved testers. The platform supplies/overwrites `oai-authenticated-user-id`; browser-supplied identity claims are not used. An empty allowlist admits nobody.
- Approved testers first open `/signin-with-chatgpt` on the public Site to establish the native identity. The browser obtains a 60-second signed grant from `POST /api/gpu/grant` after native Sites sign-in. The broker verifies purpose, audience, expiry, subject and a single-use nonce before creating a worker. Missing verifier configuration fails closed.
- Each approved subject has at most one active/starting lease. Every five minutes the browser obtains a fresh approved-identity grant. A 15-minute authorization deadline bounds bearer-only access; an expired or unrenewable authorization is rejected and reaped. Valid admitted users may keep training without an engine restart.
- Removing an approved ID stops new grants and future renewals. To revoke already-issued bearer authority immediately, stop/restart the broker and verify worker teardown. Grants already minted live for at most 60 seconds.

The security patch does not provision a GPU host, buy capacity, or change the public site's audience. Actual GPU/ICE/TURN validation is still required before enabling streaming.
