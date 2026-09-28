import { Instruction, VmValue } from "./types";
import { Position } from "../ir/ast";
import { OpCode } from "./opcodes";
import { BytecodeCompilationError } from "./errors";

export interface SerializedFunction {
    name: string;
    arity: number;
    instructions: Instruction[];
}

export class Chunk {
    public constants: VmValue[] = [];
    public instructions: Instruction[] = [];
    public functions: SerializedFunction[] = [];

    /**
     * Add a constant to the constant pool and return its index.
     */
    public addConstant(value: VmValue): number {
        // Re-use primitives if already in constant pool
        if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
            const existing = this.constants.findIndex((c) => c === value);
            if (existing !== -1) return existing;
        }
        this.constants.push(value);
        return this.constants.length - 1;
    }

    /**
     * Emit an instruction with line and column position tracking.
     */
    public emit(op: OpCode, operand?: number, pos?: Position): number {
        const position = pos ?? { line: 1, column: 1 };
        this.instructions.push({ op, operand, pos: position });
        return this.instructions.length - 1;
    }

    /**
     * Patch a jump target operand at a specific offset.
     */
    public patchJump(offset: number, target: number): void {
        if (offset < 0 || offset >= this.instructions.length) {
            throw new BytecodeCompilationError(`Invalid jump offset ${offset}`);
        }
        this.instructions[offset]!.operand = target;
    }

    /**
     * Encode chunk into `.txtc` binary format.
     */
    public encode(): Buffer {
        const magic = Buffer.from("TXTC", "ascii"); // 4 bytes magic: 0x54 0x58 0x54 0x43
        const version = Buffer.alloc(2);
        version.writeUInt16BE(1, 0); // Version 1

        const payloadObj = {
            constants: this.constants,
            instructions: this.instructions,
            functions: this.functions,
        };

        const jsonBytes = Buffer.from(JSON.stringify(payloadObj), "utf-8");
        const lengthBuf = Buffer.alloc(4);
        lengthBuf.writeUInt32BE(jsonBytes.length, 0);

        return Buffer.concat([magic, version, lengthBuf, jsonBytes]);
    }

    /**
     * Decode a `.txtc` binary file into a Chunk.
     */
    public static decode(buffer: Buffer): Chunk {
        if (buffer.length < 10) {
            throw new BytecodeCompilationError("Corrupted .txtc file: file too short");
        }

        const magic = buffer.subarray(0, 4).toString("ascii");
        if (magic !== "TXTC") {
            throw new BytecodeCompilationError(`Invalid .txtc magic header: expected 'TXTC', found '${magic}'`);
        }

        const version = buffer.readUInt16BE(4);
        if (version !== 1) {
            throw new BytecodeCompilationError(`Unsupported .txtc bytecode version: ${version}`);
        }

        const payloadLength = buffer.readUInt32BE(6);
        const payloadData = buffer.subarray(10, 10 + payloadLength).toString("utf-8");

        const parsed = JSON.parse(payloadData);
        const chunk = new Chunk();
        chunk.constants = parsed.constants || [];
        chunk.instructions = parsed.instructions || [];
        chunk.functions = parsed.functions || [];

        return chunk;
    }
}
