import { logger } from "./logger.ts";
import {
  DirectoryNotWritableError,
  DirectoryNotFoundError,
  FilesystemError,
} from "./errors.ts";

/**
 * Validate that a directory exists and is writable
 * @throws {DirectoryNotFoundError} if directory doesn't exist
 * @throws {DirectoryNotWritableError} if directory is not writable
 */
export async function validateOutputDirectory(dirPath: string): Promise<void> {
  try {
    // Check if directory exists
    const dirExists = await checkDirectoryExists(dirPath);
    if (!dirExists) {
      throw new DirectoryNotFoundError(dirPath);
    }

    // Check if directory is writable
    const isWritable = await checkDirectoryWritable(dirPath);
    if (!isWritable) {
      throw new DirectoryNotWritableError(dirPath);
    }

    logger.info("Output directory validated", { path: dirPath });
  } catch (err) {
    // Re-throw our custom errors
    if (
      err instanceof DirectoryNotFoundError ||
      err instanceof DirectoryNotWritableError
    ) {
      throw err;
    }

    // Wrap other errors
    throw new FilesystemError(
      `Failed to validate output directory: ${String(err)}`,
      dirPath
    );
  }
}

/**
 * Check if a directory exists.
 * Note: Bun.file().exists() returns false for directories (only true for files),
 * so we use fs.stat instead.
 */
async function checkDirectoryExists(dirPath: string): Promise<boolean> {
  try {
    const { stat } = await import("node:fs/promises");
    const st = await stat(dirPath);
    return st.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a directory is writable by attempting to write a test file
 */
async function checkDirectoryWritable(dirPath: string): Promise<boolean> {
  try {
    const testFile = `${dirPath}/.chatterbox_write_test_${Date.now()}`;
    const file = Bun.file(testFile);

    // Try to write to the file
    const writer = file.writer();
    writer.write("test");
    await writer.end();

    // Clean up test file
    await Bun.write(testFile, ""); // Truncate to 0 bytes

    // Try to delete the test file
    const success = await deleteFile(testFile);
    return success;
  } catch (err) {
    logger.warn("Directory writability check failed", { path: dirPath, error: String(err) });
    return false;
  }
}

/**
 * Attempt to delete a file, returning success/failure
 */
async function deleteFile(filePath: string): Promise<boolean> {
  try {
    // Use a shell command to delete the file
    const result = Bun.spawn(["rm", "-f", filePath], {
      stdout: "ignore",
      stderr: "ignore",
    });
    await result.exited;
    return true;
  } catch {
    return false;
  }
}
