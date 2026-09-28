import { Position } from "../ir/ast";

export class VmError extends Error {
    public pos?: Position;

    constructor(message: string, pos?: Position) {
        super(pos ? `${message} at ${pos.line}:${pos.column}` : message);
        this.name = "VmError";
        this.pos = pos;
    }
}

export class RuntimeError extends VmError {
    constructor(message: string, pos?: Position) {
        super(message, pos);
        this.name = "RuntimeError";
    }
}

export class BytecodeCompilationError extends VmError {
    constructor(message: string, pos?: Position) {
        super(message, pos);
        this.name = "BytecodeCompilationError";
    }
}

export class MemorySafetyError extends RuntimeError {
    constructor(message: string, pos?: Position) {
        super(`Memory safety violation: ${message}`, pos);
        this.name = "MemorySafetyError";
    }
}
