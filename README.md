# chatterbox-tts

## Project Overview

Bun-based TypeScript project for TTS (Text-to-Speech) via Runpod Chatterbox-Turbo API.

## Summary

Bun binary reads text from STDIN (truncate at ~2000 chars) → calls Runpod API → logs to SQLite → downloads WAV, converts to OGG via ffmpeg → saves to `chatterbox-tts/out/`. Filename derived from API response URL.

---

## Project Structure

```
chatterbox-tts/
├── PLAN.md
├── src/
│   ├── main.ts
│   ├── api.ts
│   ├── config.ts
│   ├── db.ts
│   ├── errors.ts
│   ├── ffmpeg.ts
│   ├── fsutils.ts
│   └── logger.ts
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
| CLI      | `-o, --out <dir>`            | Override output dir (default: `out`)                   |
| Env      | `MAX_STDIN_BYTES`            | Max stdin bytes (default: 1MB)                         |
| Implicit | CWD                          | SQLite path: `./tts-accounting.db3`                     |

## Dependencies

- **Runtime**: Bun (not Node.js)
- **Built-in**: `fetch`, `bun:sqlite`, Bun's `$` shell
- **External binary**: `ffmpeg` (must be on PATH)

## Usage

```sh
echo "What did you have for dinner today?" | bun run src/main.ts --voice abigail
```

## Build/Lint/Test Commands

```bash
# Install dependencies
bun install

# Run TypeScript type checking
bunx tsc --noEmit
```

Note: No dedicated lint/format commands yet. TypeScript strict mode catches many issues.

