import {
    OpenAIError,
    APIError,
    APIConnectionError,
    APIConnectionTimeoutError,
    APIUserAbortError,
    LengthFinishReasonError,
    ContentFilterFinishReasonError,
} from "openai/error";
import logger from "../logger";

export interface ModelExecutionError {
    type: string;
    message: string;
    line?: number;
    column?: number;
    hint?: string;
}

const KNOWN_ERROR_NAMES = new Set([
    "TypeError",
    "ValueError",
    "IndexError",
    "ZeroDivisionError",
    "NameError",
    "LoopError",
    "AmbiguityError",
    "SyntaxError",
    "DataError",
]);

/**
 * Parses structured TEXTC_ERROR blocks or legacy error formats from model responses.
 */
export function parseModelError(output: string): ModelExecutionError | null {
    const trimmed = output.trim();

    // Check for TEXTC_ERROR_START ... TEXTC_ERROR_END or [TEXTC_ERROR] ... [/TEXTC_ERROR]
    const blockMatch =
        trimmed.match(/TEXTC_ERROR_START([\s\S]*?)TEXTC_ERROR_END/i) ??
        trimmed.match(/\[TEXTC_ERROR\]([\s\S]*?)\[\/TEXTC_ERROR\]/i);

    if (blockMatch) {
        const body = blockMatch[1]!;
        const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);

        let type = "ExecutionError";
        let message = "An error occurred during algorithm execution";
        let line: number | undefined;
        let column: number | undefined;
        let hint: string | undefined;

        for (const rawLine of lines) {
            const colonIdx = rawLine.indexOf(":");
            if (colonIdx === -1) continue;

            const key = rawLine.slice(0, colonIdx).trim().toLowerCase();
            const value = rawLine.slice(colonIdx + 1).trim();

            if (key === "type") {
                type = value;
            } else if (key === "message") {
                message = value;
            } else if (key === "line" || key === "location") {
                const parsedLine = parseInt(value.replace(/\D+/g, ""), 10);
                if (!isNaN(parsedLine)) line = parsedLine;
            } else if (key === "column" || key === "col") {
                const parsedCol = parseInt(value.replace(/\D+/g, ""), 10);
                if (!isNaN(parsedCol)) column = parsedCol;
            } else if (key === "hint" || key === "help") {
                hint = value;
            }
        }

        return { type, message, line, column, hint };
    }

    // Fallback: match standard "ErrorName: message" lines
    const inlineMatch = trimmed.match(/^([A-Za-z]+Error):\s*(.+)$/i);
    if (inlineMatch && KNOWN_ERROR_NAMES.has(inlineMatch[1]!)) {
        return {
            type: inlineMatch[1]!,
            message: inlineMatch[2]!,
            line: 1,
            column: 1,
        };
    }

    return null;
}

/**
 * Renders model execution errors as clean compiler diagnostics.
 */
export function renderModelError(
    err: ModelExecutionError,
    fileName: string = "input.txt"
): void {
    const line = err.line ?? 1;
    const col = err.column ?? 1;

    logger.error(`${fileName}:${line}:${col} ${err.message} (${err.type})`);
    if (err.hint) {
        logger.info(err.hint);
    }
}

/**
 * Maps OpenAI error codes to user-friendly messages and recommendations.
 */
const ERROR_CODE_MESSAGES: Record<string, string> = {
    invalid_api_key: "Invalid API Key provided. Please verify your API key in environment variables.",
    incorrect_api_key: "The API key provided is incorrect. Please check your credentials.",
    insufficient_quota: "You have exceeded your current quota or billing limit. Check your plan and billing details.",
    quota_exceeded: "Your account quota has been exceeded.",
    model_not_found: "The specified model was not found or you do not have access to it.",
    context_length_exceeded: "The prompt or token count exceeds the maximum context length for this model.",
    rate_limit_exceeded: "You are sending requests too quickly or have hit your rate limit. Please retry later.",
    invalid_request_error: "The request was invalid. Please verify the request parameters.",
    resource_not_found: "The requested resource could not be found.",
    unsupported_country_region_territory: "Country, region, or territory not supported by the API provider.",
    server_error: "The server encountered an internal error. Please try again later.",
};

const STATUS_HINTS: Record<number, string> = {
    400: "Bad request. Please check parameters, payload format, and model arguments.",
    401: "Authentication failed. Please check if your API_KEY is valid and not expired.",
    403: "Permission denied. Your API key does not have access to the requested resource or region.",
    404: "Resource or model not found. Verify your BASE_URL and MODEL_NAME.",
    409: "Conflict error with the current state of the resource.",
    422: "Unprocessable entity. The request was well-formed but was unable to be processed.",
    429: "Rate limit reached or quota exhausted. Please check your billing or slow down requests.",
    500: "Server error on the provider's side. Please retry after a few moments.",
    502: "Bad gateway. The upstream AI provider is unreachable. Please retry.",
    503: "Service unavailable. The AI provider is temporarily overloaded.",
    504: "Gateway timeout. The AI provider did not respond in time.",
};

/**
 * Handles errors thrown by OpenAI API calls or general runtime errors.
 */
export function handleError(error: unknown): never {
    if (error instanceof APIError) {
        const status = error.status;
        const code = error.code ? String(error.code) : undefined;
        const message = error.message;

        const errorParts = [
            status ? `${status}` : undefined,
            code ? `${code}` : undefined,
            message,
        ].filter(Boolean);

        logger.error(`API Error: ${errorParts.join(" - ")}`);

        const hint = (code && ERROR_CODE_MESSAGES[code]) || (status && STATUS_HINTS[status]);
        if (hint) {
            logger.info(hint);
        }

        process.exit(1);
    }

    if (error instanceof APIConnectionTimeoutError) {
        logger.error("API connection timed out. Please check your network connection.");
        process.exit(1);
    }

    if (error instanceof APIConnectionError) {
        logger.error(`API connection failed (${error.message}). Check your network connection and BASE_URL.`);
        if (error.cause) {
            logger.error(`cause: ${error.cause instanceof Error ? error.cause.message : String(error.cause)}`);
        }
        process.exit(1);
    }

    if (error instanceof APIUserAbortError) {
        logger.error("API request was aborted.");
        process.exit(1);
    }

    if (error instanceof LengthFinishReasonError) {
        logger.error("Response generation terminated because the token length limit was reached.");
        process.exit(1);
    }

    if (error instanceof ContentFilterFinishReasonError) {
        logger.error("Response was rejected by safety content filters.");
        process.exit(1);
    }

    if (error instanceof OpenAIError) {
        logger.error(`OpenAI Error: ${error.message}`);
        process.exit(1);
    }

    if (error instanceof Error) {
        logger.error(`Error: ${error.message}`);
        process.exit(1);
    }

    logger.error("Unknown Error:", error);
    process.exit(1);
}

export default handleError;