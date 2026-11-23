# Long-session authority validation

Executed 2026-11-15T05:59:04.552Z with v24.22.1 on linux/x64. Two actual 120 Hz Free Practice authority runs each advanced 1860 seconds (223200 ticks). The first included recording up to the existing 1800-second limit; the second used identical input without a recorder.

Both final state checksums equal `40899af36fc9232f`. Total shots 5633; footsteps 2326; landings 930. Recording stopped with its explicit Korean limit message; 78 further live shots and 7080 further authority ticks succeeded. Command count stayed fixed after the cap. The failed partial recording is not exported as a valid complete replay.

Maximum retained counts: shots 2048/2048, footsteps 64/64, landings 32/32, presentation frames 32/32. 1 eliminations occurred, so no claim is made that the kill ring was saturated. Detailed heap samples, recording counts and per-minute wall times are in [LONG_SESSION.json](LONG_SESSION.json).

Wall execution: 49.08 s / 6.19 s. This is compressed simulated time, not a physical 31-minute browser soak. Heap includes intentionally retained recorder data and SSR/JIT caches. GPU resources, audio nodes, input-to-photon latency and office PC hardware are outside this test.

Reproduce: `node --expose-gc scripts/test-long-session.mjs`.
