import { OpenAI } from "openai";
import { BASE_URL, API_KEY, MODEL_NAME } from "./env";
import logger from "../logger";
import handleError from "./error";

export function checkEnvs(): void {
    const missing: string[] = [];
    if (!BASE_URL) missing.push("TEXTC_BASE_URL");
    if (!API_KEY) missing.push("TEXTC_API_KEY");
    if (!MODEL_NAME) missing.push("TEXTC_MODEL_NAME");

    if (missing.length > 0) {
        logger.error(`Missing required environment variable(s): ${missing.join(", ")}`);
        logger.warn("Please configure them before running textc.");
        process.exit(1);
    }
}

export default async function setupClient(): Promise<OpenAI> {
    checkEnvs();

    try {
        const client = new OpenAI({
            apiKey: API_KEY,
            baseURL: BASE_URL,
        });

        return client;
    } catch (err) {
        handleError(err);
    }
}