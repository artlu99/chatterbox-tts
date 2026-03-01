import { Database } from "bun:sqlite";
import { DATABASE_PATH } from "./config.ts";
import { FilesystemError } from "./errors.ts";
import { logger } from "./logger.ts";

let db: Database | null = null;

/**
 * Get or create the database connection
 * @throws {FilesystemError} if database cannot be opened
 */
function getDb(): Database {
	if (!db) {
		try {
			db = new Database(DATABASE_PATH);

			// Create table if it doesn't exist
			db.run(`
        CREATE TABLE IF NOT EXISTS tts_calls (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts TEXT NOT NULL,
          cost REAL NOT NULL,
          filename TEXT NOT NULL,
          voice TEXT NOT NULL,
          prompt_len INTEGER NOT NULL,
          execution_time_ms INTEGER,
          runpod_id TEXT
        )
      `);

			// Create indexes for better query performance
			db.run(`CREATE INDEX IF NOT EXISTS idx_ts ON tts_calls(ts)`);
			db.run(`CREATE INDEX IF NOT EXISTS idx_voice ON tts_calls(voice)`);

			logger.debug("Database initialized", { path: DATABASE_PATH });
		} catch (err) {
			throw new FilesystemError(
				`Failed to initialize database: ${String(err)}`,
				DATABASE_PATH,
			);
		}
	}
	return db;
}

export interface TtsCallRecord {
	ts: string;
	cost: number;
	filename: string;
	voice: string;
	promptLen: number;
	executionTimeMs: number | null;
	runpodId: string | null;
}

/**
 * Insert a TTS call record into the database
 * @throws {FilesystemError} if database insertion fails
 */
export function insertTtsCall(record: TtsCallRecord): void {
	const database = getDb();

	try {
		database.run(
			`INSERT INTO tts_calls (ts, cost, filename, voice, prompt_len, execution_time_ms, runpod_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				record.ts,
				record.cost,
				record.filename,
				record.voice,
				record.promptLen,
				record.executionTimeMs,
				record.runpodId,
			],
		);
		logger.debug("TTS call recorded", {
			filename: record.filename,
			cost: record.cost,
		});
	} catch (err) {
		throw new FilesystemError(
			`Failed to insert TTS call record: ${String(err)}`,
			DATABASE_PATH,
		);
	}
}
