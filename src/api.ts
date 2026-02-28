import {
  API_ENDPOINT,
  API_MAX_RETRIES,
  API_TIMEOUT_MS,
  RETRY_BACKOFF_BASE_MS,
} from "./config.ts";
import { logger } from "./logger.ts";
import {
  ApiError,
  ApiTimeoutError,
  ApiResponseValidationError,
} from "./errors.ts";

export interface ApiResponse {
  status: string;
  id: string;
  executionTime: number;
  output: {
    audio_url: string;
    cost: number;
  };
}

export interface ApiErrorResponse {
  error: string;
}

function getApiKey(): string {
  const key = process.env.RUNPOD_API_KEY ?? process.env.BEARER;
  if (!key) {
    logger.error("RUNPOD_API_KEY or BEARER environment variable required");
    throw new ApiError("RUNPOD_API_KEY or BEARER environment variable required");
  }
  return key;
}

/**
 * Validate API response structure
 * @throws {ApiResponseValidationError} if validation fails
 */
export function validateApiResponse(data: unknown): data is ApiResponse {
  const validationErrors: string[] = [];

  if (typeof data !== "object" || data === null) {
    validationErrors.push("API response is not an object");
    throw new ApiResponseValidationError(
      "API response validation failed",
      validationErrors
    );
  }

  const response = data as Record<string, unknown>;

  // Validate status
  if (typeof response.status !== "string") {
    validationErrors.push("API response missing or invalid 'status' field");
  }

  // Validate id
  if (typeof response.id !== "string") {
    validationErrors.push("API response missing or invalid 'id' field");
  }

  // Validate executionTime
  if (typeof response.executionTime !== "number") {
    validationErrors.push("API response missing or invalid 'executionTime' field");
  }

  // Validate output object
  if (typeof response.output !== "object" || response.output === null) {
    validationErrors.push("API response missing or invalid 'output' field");
  } else {
    const output = response.output as Record<string, unknown>;

    // Validate audio_url
    if (typeof output.audio_url !== "string") {
      validationErrors.push("API response missing or invalid 'output.audio_url' field");
    }

    // Validate cost
    if (typeof output.cost !== "number") {
      validationErrors.push("API response missing or invalid 'output.cost' field");
    }
  }

  if (validationErrors.length > 0) {
    throw new ApiResponseValidationError(
      "API response validation failed",
      validationErrors
    );
  }

  return true;
}

/**
 * Call the TTS API with retry logic
 * @throws {ApiError} if all retries are exhausted
 * @throws {ApiTimeoutError} if the request times out
 * @throws {ApiResponseValidationError} if the response structure is invalid
 */
export async function callTtsApi(text: string, voice: string): Promise<ApiResponse> {
  const apiKey = getApiKey();

  for (let attempt = 1; attempt <= API_MAX_RETRIES; attempt++) {
    logger.info("Calling TTS API", { attempt, voice, promptLen: text.length });

    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt: text,
            voice: voice,
            format: "wav",
          },
        }),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new ApiError(
          `HTTP request failed`,
          response.status,
          { statusText: response.statusText }
        );
      }

      const data = (await response.json()) as unknown;

      // Check for error response first
      if (typeof data === "object" && data !== null && "error" in data) {
        const errorData = data as ApiErrorResponse;
        throw new ApiError(`API returned error: ${errorData.error}`);
      }

      // Validate response structure
      try {
        validateApiResponse(data);
      } catch (err) {
        if (err instanceof ApiResponseValidationError) {
          logger.error("API response validation failed", {
            validationErrors: err.validationErrors,
            rawResponse: JSON.stringify(data).slice(0, 500),
          });
        }
        throw err;
      }

      // Now safe to use as ApiResponse
      const validatedData = data as ApiResponse;

      if (validatedData.status !== "COMPLETED") {
        throw new ApiError(
          `Unexpected status: ${validatedData.status}`,
          undefined,
          { status: validatedData.status }
        );
      }

      logger.info("TTS API call successful", {
        id: validatedData.id,
        cost: validatedData.output.cost,
      });
      return validatedData;

    } catch (err) {
      // Log the error (include validation details if available)
      const errorMessage = String(err);
      const logData: Record<string, unknown> = { attempt, error: errorMessage };
      if (err instanceof ApiResponseValidationError && err.validationErrors.length > 0) {
        logData.validationErrors = err.validationErrors;
      }
      logger.error("API call failed", logData);

      // If this is the last attempt, re-throw the error
      if (attempt === API_MAX_RETRIES) {
        if (err instanceof Error && err.name === "TimeoutError") {
          throw new ApiTimeoutError(
            `API request timed out after ${API_TIMEOUT_MS}ms`
          );
        }
        if (err instanceof ApiError) {
          throw err;
        }
        throw new ApiError(
          `All API retries exhausted: ${errorMessage}`,
          undefined,
          { originalError: err }
        );
      }

      // Wait before retrying
      const backoffMs = RETRY_BACKOFF_BASE_MS * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new ApiError("Unexpected error in API call");
}
