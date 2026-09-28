import pkg from "../../package.json";

export * from "../ai/prompts";

export const TEXTC_VERSION = pkg.version;
export const TEXTC_BYTECODE_VERSION = 1;
export const TEXTC_BYTECODE_MAGIC = "TXTC";
export const DEFAULT_EXECUTION_STEPS = 5_000_000;
