# AGENTS.md

Coding agent instructions for this repository.

## Project Overview

Bun-based TypeScript project for TTS (Text-to-Speech) via Runpod Chatterbox-Turbo API. Reads text from STDIN, calls API, logs to SQLite, converts WAV to OGG via ffmpeg.

## Build/Lint/Test Commands

```bash
# Install dependencies
bun install

# Run TypeScript type checking
bunx tsc --noEmit

# Run a file directly
bun run <file.ts>

# Run with arguments
bun run <file.ts> --voice abigail
```

Note: No dedicated lint/format commands yet. TypeScript strict mode catches many issues.

## Dependencies

- **Runtime**: Bun (not Node.js)
- **Built-in**: `fetch`, `bun:sqlite`, Bun's `$` shell
- **External binary**: `ffmpeg` (must be on PATH)

## Code Style Guidelines

### TypeScript Configuration

Strict mode enabled with:
- `strict: true`
- `noUncheckedIndexedAccess: true` - array/object access may be undefined
- `noFallthroughCasesInSwitch: true`
- `noImplicitOverride: true`
- `verbatimModuleSyntax: true` - explicit type imports required

### Imports

```typescript
// Use verbatimModuleSyntax - explicit type imports
import { foo } from "bar";
import type { SomeType } from "types";

// Bun built-ins
import { $ } from "bun";
import { Database } from "bun:sqlite";
```

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE` for module-level, `camelCase` for local
- **Types/Interfaces**: `PascalCase`
- **Environment variables**: `UPPER_SNAKE_CASE`

### Error Handling

```typescript
// Exit with code on fatal errors
if (!config.apiKey) {
  console.error("RUNPOD_API_KEY required");
  process.exit(1);
}

// Log JSON for structured output
const log = (level: string, msg: string, data?: object) => {
  console.log(JSON.stringify({ level, time: new Date().toISOString(), msg, ...data }));
};
```

### Async/Retry Pattern

```typescript
const MAX_RETRIES = 3;

for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
  try {
    // operation
    return result;
  } catch (err) {
    if (attempt === MAX_RETRIES) {
      process.exit(1);
    }
    await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
  }
}
```

### Fetch with Timeout

```typescript
const response = await fetch(url, { 
  signal: AbortSignal.timeout(30000) 
});
```

### Bun Shell ($)

```typescript
// Pipe stdin to ffmpeg
await $`ffmpeg -y -i - -c:a libvorbis -q:a 4 ${outputPath}`
  .stdin(response.body!)
  .quiet();
```

### SQLite Pattern

```typescript
import { Database } from "bun:sqlite";

const db = new Database("./tts-accounting.db");
db.run(`CREATE TABLE IF NOT EXISTS ...`);
db.run(`INSERT INTO table VALUES (?, ?)`, [val1, val2]);
```

## File Structure

```
resembleai-runpod/
├── src/
│   ├── main.ts      # Entry point, CLI parsing, orchestration
│   ├── api.ts       # Runpod API client with retry
│   ├── db.ts        # SQLite schema and operations
│   └── ffmpeg.ts    # WAV download and OGG conversion
├── out/             # Generated audio files (gitignored)
└── ...
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RUNPOD_API_KEY` or `BEARER` | Yes | API authentication |
| `VOICE` | No | Default voice (falls back to `abigail`) |

## API Response Format

See `sample-res.json` for example response structure:
- `output.audio_url` - WAV file URL
- `output.cost` - Cost in dollars
- `status` - "COMPLETED" on success
- `executionTime` - Duration in ms
- `id` - Runpod request ID

## Key Decisions

- Hardcode `chatterbox-turbo` endpoint (not configurable)
- Truncate input to 2000 chars (no logging)
- Stream directly to ffmpeg stdin (no temp files)
- Use `libvorbis -q:a 4` for OGG encoding
- 30s fetch timeout, 3 retries with exponential backoff
