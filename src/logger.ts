type LogLevel = "info" | "error" | "warn" | "debug";

interface LogEntry {
	level: LogLevel;
	time: string;
	msg: string;
	[key: string]: unknown;
}

export function log(
	level: LogLevel,
	msg: string,
	data?: Record<string, unknown>,
): void {
	const entry: LogEntry = {
		level,
		time: new Date().toISOString(),
		msg,
		...data,
	};
	console.log(JSON.stringify(entry));
}

export const logger = {
	info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
	error: (msg: string, data?: Record<string, unknown>) =>
		log("error", msg, data),
	warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
	debug: (msg: string, data?: Record<string, unknown>) =>
		log("debug", msg, data),
};
