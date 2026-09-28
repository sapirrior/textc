import setupClient from "./client";
import { MODEL_NAME } from "./env";
import handleError, { parseModelError, renderModelError } from "./error";
import { SYSTEM_PROMPT } from "../constants";
import logger from "../logger";
import { Parser, ParseError } from "../ir";
import {
    BytecodeCompiler,
    VirtualMachine,
    Chunk,
    VmError,
    RuntimeError,
    MemorySafetyError,
    BytecodeCompilationError,
} from "../vm";
import { writeFileSync } from "fs";

export interface GenerateOptions {
    fileName?: string;
    emitIr?: boolean;
    outputBytecodePath?: string;
}

function cleanIrOutput(rawText: string): string {
    let text = rawText.trim();
    if (text.startsWith("```")) {
        const firstLineEnd = text.indexOf("\n");
        const lastFence = text.lastIndexOf("```");
        if (firstLineEnd !== -1 && lastFence > firstLineEnd) {
            text = text.slice(firstLineEnd + 1, lastFence).trim();
        }
    }
    return text;
}

export default async function generate(
    code: string,
    options: GenerateOptions = {}
): Promise<string | void> {
    const client = await setupClient();
    const targetFile = options.fileName ?? "input.txt";

    const startTime = performance.now();
    logger.info(`compiling ${targetFile} (target: textc-vm)`);

    let irText = "";
    try {
        const response = await client.chat.completions.create({
            model: MODEL_NAME,
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT,
                },
                {
                    role: "user",
                    content: code,
                },
            ],
        });

        irText = cleanIrOutput(response.choices[0]?.message?.content ?? "");
    } catch (error) {
        handleError(error);
    }

    // Check if AI returned a structured translation error (e.g. non-algorithm input)
    const modelError = parseModelError(irText);
    if (modelError) {
        const duration = Math.round(performance.now() - startTime);
        logger.info(`finished in ${duration}ms`);
        renderModelError(modelError, targetFile);
        process.exit(1);
    }

    if (options.emitIr) {
        const duration = Math.round(performance.now() - startTime);
        logger.info(`finished in ${duration}ms`);
        return irText;
    }

    // Parse IR and compile to TextC .txtc bytecode
    try {
        const parser = new Parser(irText);
        const ast = parser.parse();

        const compiler = new BytecodeCompiler();
        const chunk = compiler.compile(ast);

        if (options.outputBytecodePath) {
            const encoded = chunk.encode();
            writeFileSync(options.outputBytecodePath, encoded);
            const duration = Math.round(performance.now() - startTime);
            logger.info(`finished in ${duration}ms`);
            logger.info(`emitted bytecode: ${options.outputBytecodePath}`);
            return;
        }

        // Execute inside TextC Virtual Machine
        const vm = new VirtualMachine();
        const output = vm.run(chunk);

        const duration = Math.round(performance.now() - startTime);
        logger.info(`finished in ${duration}ms`);
        return output;
    } catch (err) {
        const duration = Math.round(performance.now() - startTime);
        logger.info(`finished in ${duration}ms`);

        if (err instanceof MemorySafetyError) {
            const pos = err.pos ?? { line: 1, column: 1 };
            logger.error(`${targetFile}:${pos.line}:${pos.column} ${err.message} (MemorySafetyError)`);
            process.exit(1);
        } else if (err instanceof RuntimeError) {
            const pos = err.pos ?? { line: 1, column: 1 };
            logger.error(`${targetFile}:${pos.line}:${pos.column} ${err.message} (RuntimeError)`);
            process.exit(1);
        } else if (err instanceof BytecodeCompilationError) {
            const pos = err.pos ?? { line: 1, column: 1 };
            logger.error(`${targetFile}:${pos.line}:${pos.column} ${err.message} (BytecodeCompilationError)`);
            process.exit(1);
        } else if (err instanceof ParseError) {
            logger.error(`${targetFile}:${err.pos.line}:${err.pos.column} ${err.message} (ParseError)`);
            process.exit(1);
        } else if (err instanceof VmError) {
            const pos = err.pos ?? { line: 1, column: 1 };
            logger.error(`${targetFile}:${pos.line}:${pos.column} ${err.message} (VmError)`);
            process.exit(1);
        } else {
            logger.error(`${targetFile}:1:1 ${(err as Error).message} (ExecutionError)`);
            process.exit(1);
        }
    }
}