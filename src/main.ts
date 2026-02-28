import { callTtsApi } from "./api.ts";
import { insertTtsCall } from "./db.ts";
import { convertWavToOgg, extractFilename } from "./ffmpeg.ts";
import { logger } from "./logger.ts";
import { validateOutputDirectory } from "./fsutils.ts";
import { ValidationError, ChatterboxError } from "./errors.ts";
import {
  DEFAULT_OUTPUT_DIR,
  DEFAULT_VOICE,
  MAX_TEXT_LENGTH,
  MAX_STDIN_BYTES,
} from "./config.ts";

function parseArgs(): { voice: string; outDir: string } {
  const args = process.argv.slice(2);
  let voice = process.env.VOICE ?? DEFAULT_VOICE;
  let outDir = DEFAULT_OUTPUT_DIR;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--voice" && args[i + 1]) {
      voice = args[i + 1]!;
      i++;
    } else if ((arg === "-o" || arg === "--out") && args[i + 1]) {
      outDir = args[i + 1]!;
      i++;
    }
  }

  return { voice, outDir };
}

async function readStdin(): Promise<string> {
  const chunks: Uint8Array[] = [];
  const reader = Bun.stdin.stream().getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  
  // Validate stdin byte length before processing
  if (totalLen > MAX_STDIN_BYTES) {
    throw new ValidationError(
      `Input too large: ${totalLen} bytes exceeds maximum of ${MAX_STDIN_BYTES} bytes`,
      "stdin",
      totalLen.toString()
    );
  }

  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(combined);
}

/**
 * Validate input parameters
 * @throws {ValidationError} if validation fails
 */
function validateInput(text: string, voice: string): void {
  if (text.length === 0) {
    throw new ValidationError("No input text provided via STDIN");
  }

  if (voice.length === 0) {
    throw new ValidationError("Voice parameter cannot be empty", "voice", voice);
  }

  if (voice.length > 100) {
    throw new ValidationError("Voice parameter too long (max 100 characters)", "voice", voice);
  }
}

async function main() {
  const { voice, outDir } = parseArgs();

  logger.info("Starting Chatterbox", { voice, outDir });

  // Validate output directory before processing
  try {
    await validateOutputDirectory(outDir);
  } catch (err) {
    // This is a critical startup error - we should exit
    if (err instanceof ChatterboxError) {
      logger.error("Output directory validation failed", {
        path: outDir,
        error: err.message,
      });
      process.exit(1);
    }
    // Wrap unexpected errors
    logger.error("Unexpected error validating output directory", {
      path: outDir,
      error: String(err),
    });
    process.exit(1);
  }

  // Read and validate input
  const inputText = await readStdin();
  const text = inputText.slice(0, MAX_TEXT_LENGTH);

  try {
    validateInput(text, voice);
  } catch (err) {
    if (err instanceof ValidationError) {
      logger.error("Input validation failed", {
        error: err.message,
        field: err.field,
        value: err.value,
      });
      process.exit(1);
    }
    throw err; // Re-throw unexpected errors
  }

  logger.info("Processing input", {
    voice,
    textLen: text.length,
    truncated: inputText.length > MAX_TEXT_LENGTH,
  });

  // Call TTS API
  const response = await callTtsApi(text, voice);

  // Convert audio format
  const filename = extractFilename(response.output.audio_url);
  const outputPath = `${outDir}/${filename}`;

  await convertWavToOgg(response.output.audio_url, outputPath);

  // Record the call in the database
  insertTtsCall({
    ts: new Date().toISOString(),
    cost: response.output.cost,
    filename: filename,
    voice: voice,
    promptLen: text.length,
    executionTimeMs: response.executionTime,
    runpodId: response.id,
  });

  logger.info("TTS complete", {
    outputPath,
    cost: response.output.cost,
    executionTimeMs: response.executionTime,
  });

  process.exit(0);
}

// Global error handler
main().catch((err) => {
  if (err instanceof ChatterboxError) {
    // Handle known error types with appropriate messages
    logger.error("Fatal error", {
      errorType: err.constructor.name,
      message: err.message,
    });
  } else {
    // Handle unexpected errors
    logger.error("Unexpected fatal error", {
      error: String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
  process.exit(1);
});
