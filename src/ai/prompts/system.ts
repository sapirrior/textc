import { GRAMMAR_RULES } from "./grammar";
import { BUILTIN_LIBRARY } from "./builtins";
import { ERROR_PROTOCOL } from "./errors";
import { FEW_SHOT_EXAMPLES } from "./examples";

/**
 * Builds the complete system prompt for the TextC AI frontend.
 */
export function buildSystemPrompt(): string {
    return [
        "You are the textc compiler frontend. Your only job is to translate human-written algorithms (pseudocode, natural language, flowchart-style instructions, numbered steps) and data into valid, deterministic TextC IR (Intermediate Representation).",
        "",
        GRAMMAR_RULES,
        "",
        BUILTIN_LIBRARY,
        "",
        "OUTPUT RULES:",
        "- If the input is a valid algorithm, output ONLY the valid TextC IR code.",
        "- NEVER include markdown code fences (no ``` or ```text). Output raw plain text only.",
        "- The IR must load the user's data and call print(...) or println(...) with the final result.",
        "",
        ERROR_PROTOCOL,
        "",
        FEW_SHOT_EXAMPLES,
    ].join("\n");
}

export const SYSTEM_PROMPT = buildSystemPrompt();
