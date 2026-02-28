// API Configuration
export const API_ENDPOINT = process.env.RUNPOD_ENDPOINT ?? "https://api.runpod.ai/v2/chatterbox-turbo/runsync?wait=60000";
export const API_TIMEOUT_MS = parseInt(process.env.API_TIMEOUT_MS ?? "65000", 10);
export const API_MAX_RETRIES = parseInt(process.env.API_MAX_RETRIES ?? "3", 10);

// FFmpeg Configuration
export const FFMPEG_TIMEOUT_MS = parseInt(process.env.FFMPEG_TIMEOUT_MS ?? "60000", 10);
export const FFMPEG_MAX_RETRIES = parseInt(process.env.FFMPEG_MAX_RETRIES ?? "3", 10);
export const FFMPEG_FETCH_TIMEOUT_MS = parseInt(process.env.FFMPEG_FETCH_TIMEOUT_MS ?? "30000", 10);

// TTS Configuration
export const DEFAULT_VOICE = process.env.VOICE ?? "abigail";
export const MAX_TEXT_LENGTH = parseInt(process.env.MAX_TEXT_LEN ?? "2000", 10);

// Input Validation Configuration
// Maximum stdin bytes to prevent memory issues (1MB)
export const MAX_STDIN_BYTES = parseInt(process.env.MAX_STDIN_BYTES ?? "1048576", 10);

// Filesystem Configuration
export const DEFAULT_OUTPUT_DIR = process.env.OUTPUT_DIR ?? "out";
export const DATABASE_PATH = process.env.DB_PATH ?? "./tts-accounting.db";

// Retry backoff configuration
// Exponential backoff: base_ms * 2^attempt
// For API (3 retries): 1s, 2s, 4s
// For FFmpeg (3 retries): 2s, 4s, 8s
export const RETRY_BACKOFF_BASE_MS = 1000;
