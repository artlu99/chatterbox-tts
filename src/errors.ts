/**
 * Base error class for all Chatterbox errors
 */
export class ChatterboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatterboxError";
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * API-related errors
 */
export class ApiError extends ChatterboxError {
  constructor(message: string, public readonly statusCode?: number, public readonly details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiTimeoutError extends ApiError {
  constructor(message: string = "API request timed out") {
    super(message);
    this.name = "ApiTimeoutError";
  }
}

export class ApiAuthenticationError extends ApiError {
  constructor(message: string = "API authentication failed") {
    super(message, 401);
    this.name = "ApiAuthenticationError";
  }
}

export class ApiResponseValidationError extends ApiError {
  constructor(message: string, public readonly validationErrors: string[]) {
    super(message);
    this.name = "ApiResponseValidationError";
  }
}

/**
 * FFmpeg-related errors
 */
export class FFmpegError extends ChatterboxError {
  constructor(message: string, public readonly exitCode?: number) {
    super(message);
    this.name = "FFmpegError";
  }
}

export class FFmpegTimeoutError extends FFmpegError {
  constructor(message: string = "FFmpeg conversion timed out") {
    super(message);
    this.name = "FFmpegTimeoutError";
  }
}

/**
 * Filesystem-related errors
 */
export class FilesystemError extends ChatterboxError {
  constructor(message: string, public readonly path?: string) {
    super(message);
    this.name = "FilesystemError";
  }
}

export class OutputDirectoryError extends FilesystemError {
  constructor(message: string, path: string) {
    super(message, path);
    this.name = "OutputDirectoryError";
  }
}

export class DirectoryNotWritableError extends OutputDirectoryError {
  constructor(path: string, public readonly permissionError?: string) {
    super(`Output directory is not writable: ${path}`, path);
    this.name = "DirectoryNotWritableError";
  }
}

export class DirectoryNotFoundError extends OutputDirectoryError {
  constructor(path: string) {
    super(`Output directory does not exist: ${path}`, path);
    this.name = "DirectoryNotFoundError";
  }
}

/**
 * Validation errors
 */
export class ValidationError extends ChatterboxError {
  constructor(message: string, public readonly field?: string, public readonly value?: unknown) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Utility function to check if an error is a specific type
 */
export function isErrorOfType<T extends ChatterboxError>(
  error: unknown,
  errorClass: new (...args: unknown[]) => T
): error is T {
  return error instanceof errorClass;
}
