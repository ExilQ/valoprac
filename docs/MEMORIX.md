# Memorix onboarding — VALOPRAC / Codex

This repository provides a **prepared project memory seed** and an **opt-in installation script**, not an installed Codex plugin or populated local SQLite database. Codex's supported Memorix path is a **user-level plugin** in the actual Codex runtime; checking files into GitHub cannot install it there.

## 1. Install in the actual Codex environment

Open a shell with Codex CLI, Node.js >=22.18 (the VALOPRAC source itself requires >=24.22.1 <25), npm and Git. From the **real cloned Git root** `ExilQ/valoprac` run:

```bash
bash scripts/setup-memorix.sh
```

Equivalent manual setup (all operations happen on **that machine**):

```bash
npm install -g memorix
memorix setup --agent codex --global
memorix doctor agents --agent codex
memorix ingest log --count 500
memorix codegraph refresh
memorix status
memorix memory search --query "VALOPRAC fixed tick movement recoil"
```

Restart/open a new Codex session after plugin setup. Review the Memorix lifecycle hooks if Codex presents `/hooks` approval. Auto-capture requires its hooks to be installed, enabled and approved; do not silently grant permission. Run `codex plugin list` and `memorix doctor agents --agent codex` to confirm the plugin is available. Do not add a duplicate manual `~/.codex/config.toml` MCP entry when the plugin owns Memorix.

## 2. Initial history / memory backfill

- The script runs `memorix ingest log --count 500` on the **local Git commit history**. The current reviewed branch has only six historical `main` commits, but more may appear later. Ensure all relevant branches have been fetched before expecting their history to be indexed.
- It runs `memorix codegraph refresh` so source files can be retrieved by structure. The source code itself stays in Git.
- It stores small source-backed facts from `docs/agent-memory/VALOPRAC_CONTEXT.md` as searchable memories once per clone (marker under ignored `.memorix/`).
- For recent changes not yet in this Git snapshot, **import verified new source/reports first**. No CLI command can magically recover unpublished Codex chats, unpublished Sites revisions, local media, or closed-source account state.
- To capture future commits, consider `memorix git-hook` only after inspecting `git config core.hooksPath` and any existing `.git/hooks/post-commit`. Never overwrite another integration's hooks without review. Plugin hooks separately record selected Codex session events.

## 3. Working rule for every session

1. Open project root; check `memorix status`, `memorix context "current task"`, then read actual code, tests and `AGENTS.md`.
2. Compare memory to current Git SHA and source. Flag old or speculative memories rather than trusting them.
3. Keep each code change in Git. After verification, record a durable Memorix entry containing decision/problem, files, commit, validation, unexpected result, remaining tasks and source evidence. A feature request is not a successful implementation.
4. Preserve Codex/Claude shared local project identity; for Claude Code in the **same accessible machine** run `memorix setup --agent claude --global`. Two separate cloud/local machines do not automatically share a local SQLite file; remote sync is optional and should be configured separately after privacy review.
5. Never write API keys, secrets, `.env`, private user telemetry, transcripts, unlicensed Riot assets or protected infrastructure data into a shared memory or export.

## 4. Validation

```bash
memorix doctor agents --agent codex
memorix status
memorix receipt --json --probe "fixed-step movement and footsteps"
memorix memory search --query "VALOPRAC Codex source snapshot"
memorix ingest log --count 500
memorix codegraph status --json
```

If a command fails, report it precisely; never claim that historical memories are imported simply because this document or script exists. Script installation changes the **user environment**, not `package.json`, build output, browser gameplay, deployment, DNS or Cloudflare settings.

Official documentation: https://github.com/AVIDS2/memorix/blob/main/docs/SETUP.md and https://github.com/AVIDS2/memorix/blob/main/docs/API_REFERENCE.md.
