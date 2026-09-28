import { Chunk } from "./chunk";
import { OpCode } from "./opcodes";
import {
    VmValue,
    VariableBinding,
    Instruction,
    VmFunction,
} from "./types";
import { RuntimeError, MemorySafetyError } from "./errors";
import { Position } from "../ir/ast";

interface CallFrame {
    instructions: Instruction[];
    ip: number;
    environment: Map<string, VariableBinding>;
}

export class VirtualMachine {
    private stack: VmValue[] = [];
    private globalEnv: Map<string, VariableBinding> = new Map();
    private callStack: CallFrame[] = [];
    private outputBuffer: string[] = [];
    private maxSteps: number = 5_000_000;
    private stepCount: number = 0;

    public run(chunk: Chunk): string {
        this.stack = [];
        this.globalEnv.clear();
        this.callStack = [];
        this.outputBuffer = [];
        this.stepCount = 0;

        let frame: CallFrame = {
            instructions: chunk.instructions,
            ip: 0,
            environment: this.globalEnv,
        };
        this.callStack.push(frame);

        while (this.callStack.length > 0) {
            frame = this.callStack[this.callStack.length - 1]!;
            if (frame.ip >= frame.instructions.length) {
                this.callStack.pop();
                continue;
            }

            this.stepCount++;
            if (this.stepCount > this.maxSteps) {
                throw new RuntimeError(
                    `Execution limit exceeded (${this.maxSteps} instructions)`,
                    frame.instructions[frame.ip]?.pos
                );
            }

            const instr = frame.instructions[frame.ip++]!;
            this.executeInstruction(instr, chunk, frame);
        }

        return this.outputBuffer.join("\n");
    }

    private executeInstruction(
        instr: Instruction,
        chunk: Chunk,
        frame: CallFrame
    ): void {
        switch (instr.op) {
            case OpCode.OP_LOAD_CONST: {
                const val = chunk.constants[instr.operand!];
                this.stack.push(val === undefined ? null : val);
                break;
            }

            case OpCode.OP_POP: {
                if (this.stack.length > 0) {
                    this.stack.pop();
                }
                break;
            }

            case OpCode.OP_DUP: {
                if (this.stack.length === 0) {
                    throw new RuntimeError("Stack underflow on DUP", instr.pos);
                }
                this.stack.push(this.stack[this.stack.length - 1]!);
                break;
            }

            case OpCode.OP_DEFINE_LET: {
                const varName = chunk.constants[instr.operand!] as string;
                const value = this.popStack(instr.pos);
                frame.environment.set(varName, { value, mutable: false });
                break;
            }

            case OpCode.OP_DEFINE_MUT: {
                const varName = chunk.constants[instr.operand!] as string;
                const value = this.popStack(instr.pos);
                frame.environment.set(varName, { value, mutable: true });
                break;
            }

            case OpCode.OP_GET_VAR: {
                const varName = chunk.constants[instr.operand!] as string;
                const binding = this.lookupVariable(varName, frame);
                if (!binding) {
                    throw new RuntimeError(`Undefined variable '${varName}'`, instr.pos);
                }
                this.stack.push(binding.value);
                break;
            }

            case OpCode.OP_SET_VAR: {
                const varName = chunk.constants[instr.operand!] as string;
                const value = this.popStack(instr.pos);
                const binding = this.lookupVariable(varName, frame);
                if (!binding) {
                    throw new RuntimeError(`Undefined variable '${varName}'`, instr.pos);
                }
                if (!binding.mutable) {
                    throw new MemorySafetyError(
                        `Cannot mutate immutable variable '${varName}'. Declare it with 'mut' instead of 'let'`,
                        instr.pos
                    );
                }
                binding.value = value;
                break;
            }

            case OpCode.OP_ADD: {
                const b = this.popStack(instr.pos);
                const a = this.popStack(instr.pos);
                if (typeof a === "string" || typeof b === "string") {
                    this.stack.push(String(a) + String(b));
                } else if (typeof a === "number" && typeof b === "number") {
                    this.stack.push(a + b);
                } else if (Array.isArray(a) && Array.isArray(b)) {
                    this.stack.push([...a, ...b]);
                } else {
                    throw new RuntimeError(`Cannot add '${typeof a}' and '${typeof b}'`, instr.pos);
                }
                break;
            }

            case OpCode.OP_SUB: {
                const b = this.popNumber(instr.pos);
                const a = this.popNumber(instr.pos);
                this.stack.push(a - b);
                break;
            }

            case OpCode.OP_MUL: {
                const b = this.popNumber(instr.pos);
                const a = this.popNumber(instr.pos);
                this.stack.push(a * b);
                break;
            }

            case OpCode.OP_DIV: {
                const b = this.popNumber(instr.pos);
                const a = this.popNumber(instr.pos);
                if (b === 0) {
                    throw new MemorySafetyError("Division by zero", instr.pos);
                }
                this.stack.push(Math.floor(a / b));
                break;
            }

            case OpCode.OP_MOD: {
                const b = this.popNumber(instr.pos);
                const a = this.popNumber(instr.pos);
                if (b === 0) {
                    throw new MemorySafetyError("Modulo by zero", instr.pos);
                }
                this.stack.push(a % b);
                break;
            }

            case OpCode.OP_NEG: {
                const a = this.popNumber(instr.pos);
                this.stack.push(-a);
                break;
            }

            case OpCode.OP_NOT: {
                const a = this.popStack(instr.pos);
                this.stack.push(!this.isTruthy(a));
                break;
            }

            case OpCode.OP_EQ: {
                const b = this.popStack(instr.pos);
                const a = this.popStack(instr.pos);
                this.stack.push(this.isEqual(a, b));
                break;
            }

            case OpCode.OP_NEQ: {
                const b = this.popStack(instr.pos);
                const a = this.popStack(instr.pos);
                this.stack.push(!this.isEqual(a, b));
                break;
            }

            case OpCode.OP_LT: {
                const b = this.popNumber(instr.pos);
                const a = this.popNumber(instr.pos);
                this.stack.push(a < b);
                break;
            }

            case OpCode.OP_LTE: {
                const b = this.popNumber(instr.pos);
                const a = this.popNumber(instr.pos);
                this.stack.push(a <= b);
                break;
            }

            case OpCode.OP_GT: {
                const b = this.popNumber(instr.pos);
                const a = this.popNumber(instr.pos);
                this.stack.push(a > b);
                break;
            }

            case OpCode.OP_GTE: {
                const b = this.popNumber(instr.pos);
                const a = this.popNumber(instr.pos);
                this.stack.push(a >= b);
                break;
            }

            case OpCode.OP_AND: {
                const b = this.popStack(instr.pos);
                const a = this.popStack(instr.pos);
                this.stack.push(this.isTruthy(a) && this.isTruthy(b));
                break;
            }

            case OpCode.OP_OR: {
                const b = this.popStack(instr.pos);
                const a = this.popStack(instr.pos);
                this.stack.push(this.isTruthy(a) || this.isTruthy(b));
                break;
            }

            case OpCode.OP_JUMP: {
                frame.ip = instr.operand!;
                break;
            }

            case OpCode.OP_JUMP_IF_FALSE: {
                const cond = this.popStack(instr.pos);
                if (!this.isTruthy(cond)) {
                    frame.ip = instr.operand!;
                }
                break;
            }

            case OpCode.OP_JUMP_IF_TRUE: {
                const cond = this.popStack(instr.pos);
                if (this.isTruthy(cond)) {
                    frame.ip = instr.operand!;
                }
                break;
            }

            case OpCode.OP_LOOP: {
                frame.ip = instr.operand!;
                break;
            }

            case OpCode.OP_BUILD_ARRAY: {
                const count = instr.operand!;
                const elements: VmValue[] = [];
                for (let i = 0; i < count; i++) {
                    elements.unshift(this.popStack(instr.pos));
                }
                this.stack.push(elements);
                break;
            }

            case OpCode.OP_GET_INDEX: {
                const index = this.popNumber(instr.pos);
                const target = this.popStack(instr.pos);

                if (Array.isArray(target)) {
                    if (index < 0 || index >= target.length) {
                        throw new MemorySafetyError(
                            `Array index out of bounds: index ${index}, length ${target.length}`,
                            instr.pos
                        );
                    }
                    this.stack.push(target[index]!);
                } else if (typeof target === "string") {
                    if (index < 0 || index >= target.length) {
                        throw new MemorySafetyError(
                            `String index out of bounds: index ${index}, length ${target.length}`,
                            instr.pos
                        );
                    }
                    this.stack.push(target[index]!);
                } else {
                    throw new RuntimeError("Cannot index non-indexable value", instr.pos);
                }
                break;
            }

            case OpCode.OP_SET_INDEX: {
                const val = this.popStack(instr.pos);
                const index = this.popNumber(instr.pos);
                const target = this.popStack(instr.pos);

                if (Array.isArray(target)) {
                    if (index < 0 || index >= target.length) {
                        throw new MemorySafetyError(
                            `Array assignment out of bounds: index ${index}, length ${target.length}`,
                            instr.pos
                        );
                    }
                    target[index] = val;
                } else {
                    throw new RuntimeError("Cannot mutate non-array index", instr.pos);
                }
                break;
            }

            case OpCode.OP_ARRAY_PUSH: {
                const item = this.popStack(instr.pos);
                const arr = this.popStack(instr.pos);
                if (!Array.isArray(arr)) {
                    throw new RuntimeError("push() requires an array as first argument", instr.pos);
                }
                arr.push(item);
                this.stack.push(arr.length);
                break;
            }

            case OpCode.OP_ARRAY_POP: {
                const arr = this.popStack(instr.pos);
                if (!Array.isArray(arr)) {
                    throw new RuntimeError("pop() requires an array", instr.pos);
                }
                if (arr.length === 0) {
                    throw new MemorySafetyError("Cannot pop from empty array", instr.pos);
                }
                this.stack.push(arr.pop()!);
                break;
            }

            case OpCode.OP_ARRAY_LEN: {
                const item = this.popStack(instr.pos);
                if (Array.isArray(item) || typeof item === "string") {
                    this.stack.push(item.length);
                } else {
                    throw new RuntimeError("len() requires an array or string", instr.pos);
                }
                break;
            }

            case OpCode.OP_ARRAY_SORT: {
                const arr = this.popStack(instr.pos);
                if (!Array.isArray(arr)) {
                    throw new RuntimeError("sort() requires an array", instr.pos);
                }
                arr.sort((a, b) => {
                    if (typeof a === "number" && typeof b === "number") return a - b;
                    return String(a).localeCompare(String(b));
                });
                this.stack.push(arr);
                break;
            }

            case OpCode.OP_ARRAY_REVERSE: {
                const arr = this.popStack(instr.pos);
                if (!Array.isArray(arr)) {
                    throw new RuntimeError("reverse() requires an array", instr.pos);
                }
                arr.reverse();
                this.stack.push(arr);
                break;
            }

            case OpCode.OP_ARRAY_SWAP: {
                const j = this.popNumber(instr.pos);
                const i = this.popNumber(instr.pos);
                const arr = this.popStack(instr.pos);
                if (!Array.isArray(arr)) {
                    throw new RuntimeError("swap() requires an array", instr.pos);
                }
                if (i < 0 || i >= arr.length || j < 0 || j >= arr.length) {
                    throw new MemorySafetyError(`swap() index out of bounds: [${i}, ${j}] for length ${arr.length}`, instr.pos);
                }
                const temp = arr[i]!;
                arr[i] = arr[j]!;
                arr[j] = temp;
                this.stack.push(arr);
                break;
            }

            case OpCode.OP_ARRAY_SLICE: {
                const end = this.popNumber(instr.pos);
                const start = this.popNumber(instr.pos);
                const target = this.popStack(instr.pos);
                if (Array.isArray(target)) {
                    this.stack.push(target.slice(start, end));
                } else if (typeof target === "string") {
                    this.stack.push(target.slice(start, end));
                } else {
                    throw new RuntimeError("slice() requires an array or string", instr.pos);
                }
                break;
            }

            case OpCode.OP_ARRAY_CONTAINS: {
                const item = this.popStack(instr.pos);
                const target = this.popStack(instr.pos);
                if (Array.isArray(target)) {
                    this.stack.push(target.some((el) => this.isEqual(el, item)));
                } else if (typeof target === "string") {
                    this.stack.push(target.includes(String(item)));
                } else {
                    throw new RuntimeError("contains() requires an array or string", instr.pos);
                }
                break;
            }

            case OpCode.OP_ARRAY_INDEX_OF: {
                const item = this.popStack(instr.pos);
                const target = this.popStack(instr.pos);
                if (Array.isArray(target)) {
                    const idx = target.findIndex((el) => this.isEqual(el, item));
                    this.stack.push(idx);
                } else if (typeof target === "string") {
                    this.stack.push(target.indexOf(String(item)));
                } else {
                    throw new RuntimeError("index_of() requires an array or string", instr.pos);
                }
                break;
            }

            case OpCode.OP_ARRAY_FILL: {
                const val = this.popStack(instr.pos);
                const count = this.popNumber(instr.pos);
                if (count < 0) {
                    throw new MemorySafetyError(`fill() requires a non-negative count: ${count}`, instr.pos);
                }
                const arr = new Array(count).fill(val);
                this.stack.push(arr);
                break;
            }

            case OpCode.OP_ARRAY_SUM: {
                const target = this.popStack(instr.pos);
                if (!Array.isArray(target)) {
                    throw new RuntimeError("sum() requires an array", instr.pos);
                }
                let total = 0;
                for (const item of target) {
                    if (typeof item !== "number") {
                        throw new RuntimeError(`sum() encountered non-numeric element '${typeof item}'`, instr.pos);
                    }
                    total += item;
                }
                this.stack.push(total);
                break;
            }

            case OpCode.OP_MATH_CALL: {
                const funcName = chunk.constants[instr.operand!] as string;
                this.executeMath(funcName, instr.pos);
                break;
            }

            case OpCode.OP_PRINT: {
                const val = this.popStack(instr.pos);
                const str = this.formatValue(val);
                this.outputBuffer.push(str);
                break;
            }

            case OpCode.OP_CALL: {
                const funcName = chunk.constants[instr.operand!] as string;
                const binding = this.lookupVariable(funcName, frame);
                if (!binding || typeof binding.value !== "object" || binding.value === null || (binding.value as VmFunction).type !== "function") {
                    throw new RuntimeError(`Undefined function '${funcName}'`, instr.pos);
                }
                const fn = binding.value as VmFunction;
                const fnDef = chunk.functions[fn.chunkIndex];
                if (!fnDef) {
                    throw new RuntimeError(`Internal error: function definition not found for '${funcName}'`, instr.pos);
                }

                const newEnv = new Map<string, VariableBinding>();
                // Arguments are on the stack, already popped in function prologue
                const newFrame: CallFrame = {
                    instructions: fnDef.instructions,
                    ip: 0,
                    environment: newEnv,
                };
                this.callStack.push(newFrame);
                break;
            }

            case OpCode.OP_RETURN: {
                const retVal = this.popStack(instr.pos);
                this.callStack.pop();
                this.stack.push(retVal);
                break;
            }

            case OpCode.OP_HALT: {
                this.callStack = [];
                break;
            }
        }
    }

    private executeMath(name: string, pos: Position): void {
        switch (name) {
            case "sqrt": {
                const n = this.popNumber(pos);
                if (n < 0) throw new MemorySafetyError("Cannot calculate sqrt of negative number", pos);
                this.stack.push(Math.floor(Math.sqrt(n)));
                break;
            }
            case "abs": {
                const n = this.popNumber(pos);
                this.stack.push(Math.abs(n));
                break;
            }
            case "min": {
                const b = this.popNumber(pos);
                const a = this.popNumber(pos);
                this.stack.push(Math.min(a, b));
                break;
            }
            case "max": {
                const b = this.popNumber(pos);
                const a = this.popNumber(pos);
                this.stack.push(Math.max(a, b));
                break;
            }
            case "floor": {
                const n = this.popNumber(pos);
                this.stack.push(Math.floor(n));
                break;
            }
            case "ceil": {
                const n = this.popNumber(pos);
                this.stack.push(Math.ceil(n));
                break;
            }
            case "round": {
                const n = this.popNumber(pos);
                this.stack.push(Math.round(n));
                break;
            }
            case "pow": {
                const exponent = this.popNumber(pos);
                const base = this.popNumber(pos);
                this.stack.push(Math.pow(base, exponent));
                break;
            }
            default:
                throw new RuntimeError(`Unknown math function '${name}'`, pos);
        }
    }

    private lookupVariable(name: string, frame: CallFrame): VariableBinding | undefined {
        if (frame.environment.has(name)) {
            return frame.environment.get(name);
        }
        return this.globalEnv.get(name);
    }

    private popStack(pos: Position): VmValue {
        if (this.stack.length === 0) {
            throw new RuntimeError("Stack underflow", pos);
        }
        return this.stack.pop()!;
    }

    private popNumber(pos: Position): number {
        const val = this.popStack(pos);
        if (typeof val !== "number") {
            throw new RuntimeError(`Expected number, got '${typeof val}'`, pos);
        }
        return val;
    }

    private isTruthy(val: VmValue): boolean {
        if (val === null || val === false || val === 0 || val === "") return false;
        return true;
    }

    private isEqual(a: VmValue, b: VmValue): boolean {
        if (a === b) return true;
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (!this.isEqual(a[i]!, b[i]!)) return false;
            }
            return true;
        }
        return false;
    }

    private formatValue(val: VmValue): string {
        if (val === null) return "null";
        if (typeof val === "boolean") return val ? "true" : "false";
        if (Array.isArray(val)) {
            return `[${val.map((v) => this.formatValue(v)).join(", ")}]`;
        }
        return String(val);
    }
}
