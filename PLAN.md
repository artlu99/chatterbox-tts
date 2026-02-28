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
| Env      | `MAX_STDIN_BYTES`            | Max stdin bytes (default: 1MB)                         |
| Implicit | CWD                          | SQLite path: `./tts-accounting.db`                     |

---

## Implementation TODOs

### Project Setup
- [x] Create `resembleai-runpod/` directory structure
- [x] Create `package.json` with bun configuration
- [x] Create `tsconfig.json`
- [x] Create `out/` directory (add to .gitignore)

### main.ts - Entry Point
- [x] Parse CLI args (`--voice`, `-o/--out`)
- [x] Read STDIN until EOF
- [x] Validate stdin byte length (max 1MB default)
- [x] Truncate input text to 2000 chars (no logging)
- [x] Resolve voice priority: CLI arg > env `VOICE` > default `abigail`
- [x] Call API module with retry logic
- [x] Insert row into SQLite via db module
- [x] Download WAV, run ffmpeg, write OGG to output dir
- [x] Exit 0 on success, exit 1 on failure

### api.ts - Runpod API Client
- [x] Hardcode endpoint: `https://api.runpod.ai/v2/chatterbox-turbo/run`
- [x] Build request: `{ "input": { "prompt": "<text>", "voice": "<voice>", "format": "wav" } }`
- [x] Use `RUNPOD_API_KEY` or `BEARER` env var for auth header
- [x] Parse response: `output.audio_url`, `output.cost`, `status`, `id`, `executionTime`
- [x] Implement retry: 3 attempts with exponential backoff (2s, 4s, 8s)
- [x] Treat non-COMPLETED status as failure → retry
- [x] Exit 1 after all retries exhausted

### db.ts - SQLite Integration
- [x] Create `tts-accounting.db` in CWD using `bun:sqlite`
- [x] Create table schema:
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
- [x] Implement insert function with all fields

### ffmpeg.ts - Audio Conversion
- [x] Import `$` from "bun" for shell commands
- [x] Define constants: `MAX_RETRIES = 3`, `TIMEOUT_MS = 30000`
- [x] Implement `convertWavToOgg(url: string, outputPath: string): Promise<void>`
- [x] Add JSON logging helper: `{ level, time, msg, ...data }`
- [x] Fetch WAV from URL with `AbortSignal.timeout(30000)`
- [x] Pipe response body directly to ffmpeg stdin using Bun's `$` template:
  ```ts
  await $`ffmpeg -y -i - -c:a libvorbis -q:a 4 ${outputPath}`
    .stdin(response.body!)
    .quiet();
  ```
- [x] Retry on failure: 3 attempts with exponential backoff (2s, 4s, 8s)
- [x] Exit 1 after all retries exhausted
- [x] Log each attempt and final success/failure
- [x] Extract filename from URL, handling any extension (mp3, m4a, flac, wav, etc.)

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
| Stdin byte limit | 1MB default (configurable via `MAX_STDIN_BYTES`) |
| Filename extension handling | Extract any extension, replace with .ogg |
| Retry backoff | Exponential: 2s, 4s, 8s (base 2^attempt, starting from attempt 1) |
