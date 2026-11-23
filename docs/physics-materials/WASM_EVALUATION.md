# Bounded JavaScript/WebAssembly evaluation

Captured 2026-11-08T00:35:34.977Z with v24.19.0 on AMD EPYC 9V74 80-Core Processor.

Retain TypeScript for this patch. This experiment measures a real WebAssembly boundary and copies, but does not demonstrate an end-to-end engine benefit. Rust was not compiled or measured.

The original 192-byte module is hand-encoded in [the evaluation script](../../scripts/benchmark-wasm-evaluation.mjs), validated with WebAssembly.validate, and compiled by the JavaScript engine. No external compiler, dependency, or generated Rust artifact is used. The scalar export takes eight f64 arguments and returns one f64; the batch export reads the same eight doubles per row in linear memory and calls that kernel.

## Arithmetic and parity

`current = vx*wishX + vz*wishZ; requested = (airAccel*wishSpeed)*dt; Math.min(requested, Math.max(0, wishLimit-current))`

Both implementations preserve the exact arithmetic and multiplication order of the projection increment in current `solveAirMovement`. Wish-limit/profile selection, application to velocity, speed caps and output acceleration are outside this isolated increment kernel; this capture does not certify parity for a complete solver port.

32,795 finite-input rows (32,768 seeded and 27 edge rows) pass exact Object.is checks: 32,795 scalar comparisons plus 131,180 batch comparisons, with zero mismatches. This includes 7 negative-zero and 14,542 positive-zero outputs, unchanged input bytes, and a zero-count batch.

## Boundary and copy timings

Times are nanoseconds per input row; smaller is faster. Every case uses the same 1024 seeded rows, calibrated repeated passes, warmup, fifteen alternating samples, and matching exact checksums. Values are medians; the JSON retains min, p90, max and all fifteen samples. Speedup is JS median divided by Wasm median; a value below 1 means Wasm is slower.

| Case | Rows per Wasm call | JS median (ns) | Wasm median (ns) | JS/Wasm ratio |
| --- | ---: | ---: | ---: | ---: |
| scalar eight-f64 JS/Wasm boundary | 1 | 3.51 | 8.50 | 0.413 |
| packed batch including input and output copies | 1 | 8.23 | 31.72 | 0.259 |
| packed batch including input and output copies | 16 | 6.36 | 4.94 | 1.287 |
| packed batch including input and output copies | 128 | 6.36 | 3.58 | 1.777 |
| packed batch including input and output copies | 1024 | 6.33 | 4.18 | 1.515 |

Batch timing includes the input copy into Wasm linear memory (64 bytes per row), the boundary call and kernel, the output copy back to a JavaScript Float64Array (8 bytes per row), and a checksum over every output. The JS comparison reads the same packed input, writes the same output array, and runs the same checksum. Memory allocation and typed-array view creation occur before timing.

## Scope and adoption decision

This is a favorable Wasm lower bound because input is already in packed Float64Arrays. Reading the existing Velocity/Vector3 objects, resolving profiles, packing values and applying outputs back to engine objects are not modeled. Kernel batching also requires independent work; the application currently steps one authoritative player movement state at a time.

These measurements do not cover collision, AI, replay, audio, rendering, a complete movement update or Simulation.step. They do not establish browser, office-PC, gaming-PC, complete-frame FPS, or physical input-latency gains. Any future adoption needs an actual engine prototype with its full data path and exact gameplay/replay parity, followed by end-to-end measurement. The measured boundary/copy result alone does not justify replacing the current TypeScript runtime.

No rustc, cargo, clang or wasm-opt is installed in this executor. Rust remains unmeasured; the JSON records tool inventory and source/module hashes.

```sh
node scripts/benchmark-wasm-evaluation.mjs --parity-only
node scripts/benchmark-wasm-evaluation.mjs
```
