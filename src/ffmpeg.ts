import {
  FFMPEG_FETCH_TIMEOUT_MS,
  FFMPEG_MAX_RETRIES,
  FFMPEG_TIMEOUT_MS,
  RETRY_BACKOFF_BASE_MS,
} from "./config.ts";
import { logger } from "./logger.ts";
import { FFmpegError, FFmpegTimeoutError, FilesystemError } from "./errors.ts";

/**
 * Convert WAV audio from URL to OGG format using FFmpeg
 * @throws {FFmpegError} if FFmpeg conversion fails
 * @throws {FFmpegTimeoutError} if FFmpeg times out
 * @throws {FilesystemError} if file writing fails
 */
export async function convertWavToOgg(url: string, outputPath: string): Promise<void> {
  for (let attempt = 1; attempt <= FFMPEG_MAX_RETRIES; attempt++) {
    logger.info("Starting conversion", { url, outputPath, attempt });

    try {
      // Fetch the WAV file with timeout
      const response = await fetch(url, {
        signal: AbortSignal.timeout(FFMPEG_FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new FilesystemError(
          `Failed to fetch audio file: HTTP ${response.status}`,
          outputPath
        );
      }

      const wavBuffer = Buffer.from(await response.arrayBuffer());

      // Spawn FFmpeg process
      const result = Bun.spawn([
        "ffmpeg",
        "-y", // Overwrite output file if it exists
        "-i",
        "-", // Read from stdin
        "-c:a",
        "libvorbis",
        "-q:a",
        "4",
        outputPath,
      ], {
        stdin: wavBuffer,
        stdout: "ignore",
        stderr: "ignore",
      });

      // Add timeout to ffmpeg process
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          result.kill();
          reject(new FFmpegTimeoutError(
            `ffmpeg conversion timed out after ${FFMPEG_TIMEOUT_MS}ms`
          ));
        }, FFMPEG_TIMEOUT_MS);
      });

      const exitCode = await Promise.race([
        result.exited,
        timeoutPromise,
      ]);

      if (exitCode !== 0) {
        throw new FFmpegError(
          `ffmpeg exited with code ${exitCode}`,
          exitCode
        );
      }

      logger.info("Conversion complete", { outputPath });
      return;

    } catch (err) {
      const errorMessage = String(err);
      logger.error("Conversion attempt failed", {
        url,
        outputPath,
        attempt,
        error: errorMessage,
      });

      // If this is the last attempt, re-throw the error
      if (attempt === FFMPEG_MAX_RETRIES) {
        if (err instanceof FFmpegError || err instanceof FilesystemError) {
          throw err;
        }
        throw new FFmpegError(
          `All conversion retries exhausted: ${errorMessage}`,
          undefined
        );
      }

      // Wait before retrying with exponential backoff
      // Backoff: 2s, 4s, 8s for attempts 1, 2, 3 (base 2^attempt * RETRY_BACKOFF_BASE_MS)
      const backoffMs = RETRY_BACKOFF_BASE_MS * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new FFmpegError("Unexpected error in FFmpeg conversion");
}

/**
 * Extract filename from a URL and change extension to .ogg
 * Handles any file extension (mp3, m4a, flac, wav, etc.)
 * @throws {FilesystemError} if the URL is invalid
 */
export function extractFilename(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const basename = pathname.split("/").pop() ?? "output";
    
    // Remove any existing extension and add .ogg
    // Match the last dot followed by file extension (3-4 chars typically)
    const lastDotIndex = basename.lastIndexOf(".");
    
    if (lastDotIndex > 0 && lastDotIndex < basename.length - 1) {
      // Check if there's a reasonable extension after the dot
      const extension = basename.slice(lastDotIndex + 1);
      if (extension.length >= 2 && extension.length <= 10) {
        return basename.slice(0, lastDotIndex) + ".ogg";
      }
    }
    
    // No extension or unusual extension, just append .ogg
    return basename + ".ogg";
  } catch (err) {
    throw new FilesystemError(
      `Failed to parse URL and extract filename: ${String(err)}`,
      url
    );
  }
}
