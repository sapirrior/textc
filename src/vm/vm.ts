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
import { BUILTINS_MAP, HostCtx, formatVmValue } from "../stdlib/registry";

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
                this.stack.push(a / b);
                break;
            }

            case OpCode.OP_IDIV: {
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
                // Floored modulo: sign follows divisor
                const rem = a % b;
                const flooredMod = rem !== 0 && (rem < 0 !== b < 0) ? rem + b : rem;
                this.stack.push(flooredMod === 0 ? 0 : flooredMod);
                break;
            }

            case OpCode.OP_POW: {
                const b = this.popNumber(instr.pos);
                const a = this.popNumber(instr.pos);
                this.stack.push(Math.pow(a, b));
                break;
            }

            case OpCode.OP_NEG: {
                const a = this.popNumber(instr.pos);
                this.stack.push(-a);
                break;
            }

            case OpCode.OP_NOT: {
                const a = this.popBool(instr.pos);
                this.stack.push(!a);
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
                const b = this.popStack(instr.pos);
                const a = this.popStack(instr.pos);
                this.stack.push(this.compareValues(a, b, "<", instr.pos));
                break;
            }

            case OpCode.OP_LTE: {
                const b = this.popStack(instr.pos);
                const a = this.popStack(instr.pos);
                this.stack.push(this.compareValues(a, b, "<=", instr.pos));
                break;
            }

            case OpCode.OP_GT: {
                const b = this.popStack(instr.pos);
                const a = this.popStack(instr.pos);
                this.stack.push(this.compareValues(a, b, ">", instr.pos));
                break;
            }

            case OpCode.OP_GTE: {
                const b = this.popStack(instr.pos);
                const a = this.popStack(instr.pos);
                this.stack.push(this.compareValues(a, b, ">=", instr.pos));
                break;
            }

            case OpCode.OP_AND: {
                const b = this.popBool(instr.pos);
                const a = this.popBool(instr.pos);
                this.stack.push(a && b);
                break;
            }

            case OpCode.OP_OR: {
                const b = this.popBool(instr.pos);
                const a = this.popBool(instr.pos);
                this.stack.push(a || b);
                break;
            }

            case OpCode.OP_JUMP: {
                frame.ip = instr.operand!;
                break;
            }

            case OpCode.OP_JUMP_IF_FALSE: {
                const cond = this.popBool(instr.pos);
                if (!cond) {
                    frame.ip = instr.operand!;
                }
                break;
            }

            case OpCode.OP_JUMP_IF_TRUE: {
                const cond = this.popBool(instr.pos);
                if (cond) {
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
                const index = this.popIndex(instr.pos);
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
                const index = this.popIndex(instr.pos);
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

            case OpCode.OP_CALL_BUILTIN: {
                const callInfo = chunk.constants[instr.operand!];
                let name: string;
                let argc: number;
                if (typeof callInfo === "object" && callInfo !== null && "name" in callInfo) {
                    name = (callInfo as any).name;
                    argc = (callInfo as any).argc;
                } else {
                    name = callInfo as string;
                    argc = 1;
                }

                const builtin = BUILTINS_MAP.get(name);
                if (!builtin) {
                    throw new RuntimeError(`Undefined built-in function '${name}'`, instr.pos);
                }
                if (argc < builtin.arity[0] || argc > builtin.arity[1]) {
                    throw new RuntimeError(
                        `Built-in '${name}' expects between ${builtin.arity[0]} and ${builtin.arity[1]} arguments, got ${argc}`,
                        instr.pos
                    );
                }

                const args: VmValue[] = [];
                for (let i = 0; i < argc; i++) {
                    args.unshift(this.popStack(instr.pos));
                }

                const ctx: HostCtx = {
                    pos: instr.pos,
                    print: (str) => this.outputBuffer.push(str),
                    isEqual: (a, b) => this.isEqual(a, b),
                };

                const result = builtin.impl(args, ctx);
                this.stack.push(result);
                break;
            }

            case OpCode.OP_CALL: {
                const callInfo = chunk.constants[instr.operand!];
                let funcName: string;
                let argc: number | undefined;
                if (typeof callInfo === "object" && callInfo !== null && "name" in callInfo) {
                    funcName = (callInfo as any).name;
                    argc = (callInfo as any).argc;
                } else {
                    funcName = callInfo as string;
                }

                const binding = this.lookupVariable(funcName, frame);
                if (!binding || typeof binding.value !== "object" || binding.value === null || (binding.value as VmFunction).type !== "function") {
                    throw new RuntimeError(`Undefined function '${funcName}'`, instr.pos);
                }
                const fn = binding.value as VmFunction;
                if (argc !== undefined && argc !== fn.arity) {
                    throw new RuntimeError(
                        `Function '${funcName}' expects ${fn.arity} arguments, got ${argc}`,
                        instr.pos
                    );
                }
                const fnDef = chunk.functions[fn.chunkIndex];
                if (!fnDef) {
                    throw new RuntimeError(`Internal error: function definition not found for '${funcName}'`, instr.pos);
                }

                const newEnv = new Map<string, VariableBinding>();
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

            // Legacy array & math operations for backwards compatibility
            case OpCode.OP_ARRAY_PUSH: {
                const item = this.popStack(instr.pos);
                const arr = this.popArray(instr.pos);
                arr.push(item);
                this.stack.push(arr.length);
                break;
            }

            case OpCode.OP_ARRAY_POP: {
                const arr = this.popArray(instr.pos);
                if (arr.length === 0) throw new MemorySafetyError("Cannot pop from empty array", instr.pos);
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
                const arr = this.popArray(instr.pos);
                if (arr.length > 1) {
                    const firstType = typeof arr[0];
                    for (let i = 1; i < arr.length; i++) {
                        if (typeof arr[i] !== firstType) {
                            throw new RuntimeError(`sort() requires homogeneous elements, got '${firstType}' and '${typeof arr[i]}'`, instr.pos);
                        }
                    }
                    arr.sort((a, b) => {
                        if (typeof a === "number" && typeof b === "number") return a - b;
                        if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
                        return 0;
                    });
                }
                this.stack.push(arr);
                break;
            }

            case OpCode.OP_ARRAY_REVERSE: {
                const arr = this.popArray(instr.pos);
                arr.reverse();
                this.stack.push(arr);
                break;
            }

            case OpCode.OP_ARRAY_SWAP: {
                const j = this.popIndex(instr.pos);
                const i = this.popIndex(instr.pos);
                const arr = this.popArray(instr.pos);
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
                const end = this.popIndex(instr.pos);
                const start = this.popIndex(instr.pos);
                const target = this.popStack(instr.pos);
                if (Array.isArray(target)) {
                    const s = Math.max(0, Math.min(start, target.length));
                    const e = Math.max(s, Math.min(end, target.length));
                    this.stack.push(target.slice(s, e));
                } else if (typeof target === "string") {
                    const s = Math.max(0, Math.min(start, target.length));
                    const e = Math.max(s, Math.min(end, target.length));
                    this.stack.push(target.slice(s, e));
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
                const count = this.popIndex(instr.pos);
                if (count < 0) {
                    throw new MemorySafetyError(`fill() requires a non-negative count: ${count}`, instr.pos);
                }
                const arr = new Array(count).fill(val);
                this.stack.push(arr);
                break;
            }

            case OpCode.OP_ARRAY_SUM: {
                const target = this.popArray(instr.pos);
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
                const str = formatVmValue(val);
                this.outputBuffer.push(str);
                break;
            }
        }
    }

    private executeMath(name: string, pos: Position): void {
        switch (name) {
            case "sqrt": {
                const n = this.popNumber(pos);
                if (n < 0) throw new MemorySafetyError("Cannot calculate sqrt of negative number", pos);
                this.stack.push(Math.sqrt(n));
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
            case "sin": {
                const n = this.popNumber(pos);
                this.stack.push(Math.sin(n));
                break;
            }
            case "cos": {
                const n = this.popNumber(pos);
                this.stack.push(Math.cos(n));
                break;
            }
            case "log": {
                const n = this.popNumber(pos);
                if (n <= 0) throw new RuntimeError("log() of non-positive number", pos);
                this.stack.push(Math.log(n));
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

    private popStack(pos?: Position): VmValue {
        if (this.stack.length === 0) {
            throw new RuntimeError("Stack underflow", pos);
        }
        return this.stack.pop()!;
    }

    private popNumber(pos?: Position): number {
        const val = this.popStack(pos);
        if (typeof val !== "number") {
            throw new RuntimeError(`Expected number, got '${typeof val}'`, pos);
        }
        return val;
    }

    private popIndex(pos?: Position): number {
        const val = this.popStack(pos);
        if (typeof val !== "number" || !Number.isInteger(val)) {
            throw new RuntimeError(`Expected integer index, got '${typeof val === "number" ? val : typeof val}'`, pos);
        }
        return val;
    }

    private popBool(pos?: Position): boolean {
        const val = this.popStack(pos);
        if (typeof val !== "boolean") {
            throw new RuntimeError(`Condition must be boolean, got '${typeof val}'`, pos);
        }
        return val;
    }

    private popArray(pos?: Position): VmValue[] {
        const val = this.popStack(pos);
        if (!Array.isArray(val)) {
            throw new RuntimeError(`Expected array, got '${typeof val}'`, pos);
        }
        return val;
    }

    private compareValues(a: VmValue, b: VmValue, op: "<" | "<=" | ">" | ">=", pos?: Position): boolean {
        if (typeof a === "number" && typeof b === "number") {
            if (op === "<") return a < b;
            if (op === "<=") return a <= b;
            if (op === ">") return a > b;
            if (op === ">=") return a >= b;
        }
        if (typeof a === "string" && typeof b === "string") {
            // Unicode code point order
            if (op === "<") return a < b;
            if (op === "<=") return a <= b;
            if (op === ">") return a > b;
            if (op === ">=") return a >= b;
        }
        throw new RuntimeError(`Cannot compare '${typeof a}' and '${typeof b}'`, pos);
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
}
