---
name: Resemble Runpod Pipeline
overview: A Bun CLI pipeline that reads text from STDIN, calls Runpod Chatterbox-Turbo TTS API, logs costs to SQLite, converts WAV to OGG via ffmpeg, and saves to resembleai-runpod/out. Includes retry logic and configurable voice.
todos: []
isProject: false
---

# Resemble AI Runpod Pipeline – Implementation Plan

## Summary

Bun binary that: reads text from STDIN (truncate at ~2000 chars) → calls Runpod API → logs to SQLite → downloads WAV, converts to OGG via ffmpeg → saves to `resembleai-runpod/out/`. Filename derived from API response URL.

---

## Project Structure

```
resembleai-runpod/
├── PLAN.md
├── src/
│   ├── main.ts
│   ├── api.ts
│   ├── db.ts
│   └── ffmpeg.ts
├── out/
├── package.json
└── tsconfig.json
```

---

## Configuration

| Source   | Variable                     | Purpose                                                |
| -------- | ---------------------------- | ------------------------------------------------------ |
| Env      | `RUNPOD_API_KEY` or `BEARER` | API auth                                               |
| Env      | `VOICE`                      | Default voice (e.g. `abigail`)                         |
| CLI      | `--voice <id>`               | Override voice                                         |
| CLI      | `-o, --out <dir>`            | Override output dir (default: `resembleai-runpod/out`) |
| Implicit | CWD                          | SQLite path: `./tts-accounting.db`                     |

---

## Implementation TODOs

### Project Setup
- [ ] Create `resembleai-runpod/` directory structure
- [ ] Create `package.json` with bun configuration
- [ ] Create `tsconfig.json`
- [ ] Create `out/` directory (add to .gitignore)

### main.ts - Entry Point
- [ ] Parse CLI args (`--voice`, `-o/--out`)
- [ ] Read STDIN until EOF
- [ ] Truncate input text to 2000 chars (no logging)
- [ ] Resolve voice priority: CLI arg > env `VOICE` > default `abigail`
- [ ] Call API module with retry logic
- [ ] Insert row into SQLite via db module
- [ ] Download WAV, run ffmpeg, write OGG to output dir
- [ ] Exit 0 on success, exit 1 on failure

### api.ts - Runpod API Client
- [ ] Hardcode endpoint: `https://api.runpod.ai/v2/chatterbox-turbo/run`
- [ ] Build request: `{ "input": { "prompt": "<text>", "voice": "<voice>", "format": "wav" } }`
- [ ] Use `RUNPOD_API_KEY` or `BEARER` env var for auth header
- [ ] Parse response: `output.audio_url`, `output.cost`, `status`, `id`, `executionTime`
- [ ] Implement retry: 3 attempts with exponential backoff (1s, 2s, 4s)
- [ ] Treat non-COMPLETED status as failure → retry
- [ ] Exit 1 after all retries exhausted

### db.ts - SQLite Integration
- [ ] Create `tts-accounting.db` in CWD using `bun:sqlite`
- [ ] Create table schema:
  ```sql
  CREATE TABLE IF NOT EXISTS tts_calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    cost REAL NOT NULL,
    filename TEXT NOT NULL,
    voice TEXT NOT NULL,
    prompt_len INTEGER NOT NULL,
    execution_time_ms INTEGER,
    runpod_id TEXT
  );
  CREATE INDEX idx_ts ON tts_calls(ts);
  CREATE INDEX idx_voice ON tts_calls(voice);
  ```
- [ ] Implement insert function with all fields

### ffmpeg.ts - Audio Conversion
- [ ] Import `$` from "bun" for shell commands
- [ ] Define constants: `MAX_RETRIES = 3`, `TIMEOUT_MS = 30000`
- [ ] Implement `convertWavToOgg(url: string, outputPath: string): Promise<void>`
- [ ] Add JSON logging helper: `{ level, time, msg, ...data }`
- [ ] Fetch WAV from URL with `AbortSignal.timeout(30000)`
- [ ] Pipe response body directly to ffmpeg stdin using Bun's `$` template:
  ```ts
  await $`ffmpeg -y -i - -c:a libvorbis -q:a 4 ${outputPath}`
    .stdin(response.body!)
    .quiet();
  ```
- [ ] Retry on failure: 3 attempts with exponential backoff (2s, 4s, 8s)
- [ ] Exit 1 after all retries exhausted
- [ ] Log each attempt and final success/failure

---

## Dependencies

- `bun` (runtime)
- `bun:sqlite` (built-in)
- `fetch` (built-in)
- `ffmpeg` (external binary)

---

## Usage

```sh
echo "What did you have for dinner today?" | RUNPOD_API_KEY=xxx bun run resembleai-runpod/src/main.ts --voice abigail
```

---

## Decisions (Resolved)

| Question | Decision |
|----------|----------|
| Runpod endpoint URL | Hardcode `chatterbox-turbo` |
| Text truncation logging | No logging |
| Temp file location | Stream directly to ffmpeg stdin (no temp file) |
| Audio codec | `libvorbis` with quality 4 |
| Fetch timeout | 30000ms |
| Retry backoff | Exponential: 2s, 4s, 8s (base 2^attempt) |
