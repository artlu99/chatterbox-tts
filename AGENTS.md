# AGENTS.md

Coding agent instructions for this repository.

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

## Key Decisions

- Hardcode `chatterbox-turbo` endpoint (not configurable)
- Truncate input to 2000 chars (no logging)
- Stream directly to ffmpeg stdin (no temp files)
- Use `libvorbis -q:a 4` for OGG encoding
- 30s fetch timeout, 3 retries with exponential backoff
