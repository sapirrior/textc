#!/usr/bin/env node
import { existsSync, readFileSync } from "fs";
import path from "path";
import { generate } from "./ai";
import logger from "./logger";
import { Chunk, VirtualMachine, RuntimeError, MemorySafetyError } from "./vm";

async function main(): Promise<void> {
    const rawArgs = process.argv.slice(2);

    let emitIr = false;
    let runDirectly = false;
    let outputBytecodePath: string | undefined;
    const fileArgs: string[] = [];

    for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i]!;
        if (arg === "--emit-ir" || arg === "-S") {
            emitIr = true;
        } else if (arg === "--run" || arg === "-r" || arg === "run") {
            runDirectly = true;
        } else if (arg === "-o" || arg === "--output") {
            i++;
            if (i >= rawArgs.length) {
                logger.error("Expected output bytecode path after -o");
                process.exit(1);
            }
            outputBytecodePath = path.resolve(process.cwd(), rawArgs[i]!);
        } else {
            fileArgs.push(arg);
        }
    }

    if (fileArgs.length === 0) {
        logger.error("No input file provided. Usage: textc <file> [-o <output.txtc>] [--emit-ir] [--run]");
        process.exit(1);
    }

    if (fileArgs.length > 1) {
        logger.error("Only one file input is supported.");
        process.exit(1);
    }

    const inputArg = fileArgs[0]!;
    const filePath = path.resolve(process.cwd(), inputArg);

    if (!existsSync(filePath)) {
        logger.error(`File not found: ${inputArg}`);
        process.exit(1);
    }

    const fileName = path.basename(filePath);

    // Direct execution of precompiled .txtc bytecode files
    if (filePath.endsWith(".txtc")) {
        const startTime = performance.now();
        logger.info(`running ${fileName} on textc-vm`);
        try {
            const rawBuffer = readFileSync(filePath);
            const chunk = Chunk.decode(rawBuffer);
            const vm = new VirtualMachine();
            const output = vm.run(chunk);

            const duration = Math.round(performance.now() - startTime);
            logger.info(`finished in ${duration}ms`);
            if (output !== "") {
                console.log(output);
            }
            return;
        } catch (err) {
            const duration = Math.round(performance.now() - startTime);
            logger.info(`finished in ${duration}ms`);
            if (err instanceof MemorySafetyError || err instanceof RuntimeError) {
                const pos = err.pos ?? { line: 1, column: 1 };
                logger.error(`${fileName}:${pos.line}:${pos.column} ${err.message} (${err.name})`);
            } else {
                logger.error(`${fileName}:1:1 ${(err as Error).message} (BytecodeExecutionError)`);
            }
            process.exit(1);
        }
    }

    // Default output .txtc file when compiling source files without -o
    if (!outputBytecodePath && !emitIr && !runDirectly) {
        const baseName = path.basename(filePath, path.extname(filePath));
        outputBytecodePath = path.resolve(process.cwd(), `${baseName}.txtc`);
    }

    let fileContent: string;
    try {
        fileContent = readFileSync(filePath, "utf-8");
    } catch (err) {
        logger.error(`Failed to read file '${inputArg}': ${(err as Error).message}`);
        process.exit(1);
    }

    const result = await generate(fileContent, {
        fileName,
        emitIr,
        outputBytecodePath,
    });

    if (result !== undefined && result !== null && result !== "") {
        console.log(result);
    }
}

main().catch((err) => {
    logger.error(`Fatal compiler error: ${(err as Error).message}`);
    process.exit(1);
});