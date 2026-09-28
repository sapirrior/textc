import { Position } from "../ir/ast";
import { RuntimeError, MemorySafetyError } from "../vm/errors";
import { VmValue } from "../vm/types";

export interface HostCtx {
    pos?: Position;
    print: (val: string) => void;
    isEqual: (a: VmValue, b: VmValue) => boolean;
}

export interface Builtin {
    name: string;
    sig: string;
    doc: string;
    arity: [min: number, max: number];
    pure: boolean;
    impl: (args: VmValue[], ctx: HostCtx) => VmValue;
    example: string;
}

function checkNumber(val: VmValue, name: string, pos?: Position): number {
    if (typeof val !== "number") {
        throw new RuntimeError(`Expected number for ${name}, got '${typeof val}'`, pos);
    }
    return val;
}

function checkInteger(val: VmValue, name: string, pos?: Position): number {
    const num = checkNumber(val, name, pos);
    if (!Number.isInteger(num)) {
        throw new RuntimeError(`Expected integer for ${name}, got ${num}`, pos);
    }
    return num;
}

function checkString(val: VmValue, name: string, pos?: Position): string {
    if (typeof val !== "string") {
        throw new RuntimeError(`Expected string for ${name}, got '${typeof val}'`, pos);
    }
    return val;
}

function checkArray(val: VmValue, name: string, pos?: Position): VmValue[] {
    if (!Array.isArray(val)) {
        throw new RuntimeError(`Expected array for ${name}, got '${typeof val}'`, pos);
    }
    return val;
}

function gcdInt(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
        const t = y;
        y = x % y;
        x = t;
    }
    return x;
}

export const BUILTINS: Builtin[] = [
    {
        name: "len",
        sig: "len(val: list | str) -> int",
        doc: "returns length of array or string",
        arity: [1, 1],
        pure: true,
        example: "len([1, 2, 3])",
        impl: (args, ctx) => {
            const val = args[0]!;
            if (Array.isArray(val) || typeof val === "string") {
                return val.length;
            }
            throw new RuntimeError(`len() requires an array or string, got '${typeof val}'`, ctx.pos);
        },
    },
    {
        name: "push",
        sig: "push(arr: list, item: any) -> int",
        doc: "appends item to array and returns new length",
        arity: [2, 2],
        pure: false,
        example: "let a = [1]; push(a, 2);",
        impl: (args, ctx) => {
            const arr = checkArray(args[0]!, "push() first argument", ctx.pos);
            arr.push(args[1]!);
            return arr.length;
        },
    },
    {
        name: "pop",
        sig: "pop(arr: list) -> any",
        doc: "removes and returns last element",
        arity: [1, 1],
        pure: false,
        example: "let a = [1, 2]; pop(a);",
        impl: (args, ctx) => {
            const arr = checkArray(args[0]!, "pop()", ctx.pos);
            if (arr.length === 0) {
                throw new MemorySafetyError("Cannot pop from empty array", ctx.pos);
            }
            return arr.pop()!;
        },
    },
    {
        name: "swap",
        sig: "swap(arr: list, i: int, j: int) -> list",
        doc: "swaps arr[i] and arr[j] in-place",
        arity: [3, 3],
        pure: false,
        example: "let a = [1, 2]; swap(a, 0, 1);",
        impl: (args, ctx) => {
            const arr = checkArray(args[0]!, "swap()", ctx.pos);
            const i = checkInteger(args[1]!, "swap() index 1", ctx.pos);
            const j = checkInteger(args[2]!, "swap() index 2", ctx.pos);
            if (i < 0 || i >= arr.length || j < 0 || j >= arr.length) {
                throw new MemorySafetyError(`swap() index out of bounds: [${i}, ${j}] for length ${arr.length}`, ctx.pos);
            }
            const temp = arr[i]!;
            arr[i] = arr[j]!;
            arr[j] = temp;
            return arr;
        },
    },
    {
        name: "slice",
        sig: "slice(val: list | str, start: int, end: int) -> list | str",
        doc: "returns sub-array or substring from start to end without wrapping negative indices",
        arity: [3, 3],
        pure: true,
        example: "slice([1, 2, 3, 4], 1, 3)",
        impl: (args, ctx) => {
            const val = args[0]!;
            const rawStart = checkInteger(args[1]!, "slice() start", ctx.pos);
            const rawEnd = checkInteger(args[2]!, "slice() end", ctx.pos);

            const len = Array.isArray(val) || typeof val === "string" ? val.length : -1;
            if (len === -1) {
                throw new RuntimeError("slice() requires an array or string", ctx.pos);
            }

            // Clamping without negative wrapping
            const start = Math.max(0, Math.min(rawStart, len));
            const end = Math.max(start, Math.min(rawEnd, len));

            if (Array.isArray(val)) {
                return val.slice(start, end);
            }
            return (val as string).slice(start, end);
        },
    },
    {
        name: "reverse",
        sig: "reverse(arr: list) -> list",
        doc: "reverses array in-place",
        arity: [1, 1],
        pure: false,
        example: "let a = [1, 2]; reverse(a);",
        impl: (args, ctx) => {
            const arr = checkArray(args[0]!, "reverse()", ctx.pos);
            arr.reverse();
            return arr;
        },
    },
    {
        name: "sort",
        sig: "sort(arr: list) -> list",
        doc: "sorts array in ascending order in-place (homogeneous types only)",
        arity: [1, 1],
        pure: false,
        example: "let a = [3, 1, 2]; sort(a);",
        impl: (args, ctx) => {
            const arr = checkArray(args[0]!, "sort()", ctx.pos);
            if (arr.length <= 1) return arr;

            const firstType = typeof arr[0];
            for (let i = 1; i < arr.length; i++) {
                if (typeof arr[i] !== firstType) {
                    throw new RuntimeError(
                        `sort() requires homogeneous elements, got '${firstType}' and '${typeof arr[i]}'`,
                        ctx.pos
                    );
                }
            }

            arr.sort((a, b) => {
                if (typeof a === "number" && typeof b === "number") return a - b;
                if (typeof a === "string" && typeof b === "string") {
                    return a < b ? -1 : a > b ? 1 : 0;
                }
                return 0;
            });
            return arr;
        },
    },
    {
        name: "contains",
        sig: "contains(val: list | str, item: any) -> bool",
        doc: "true if item is in array or string",
        arity: [2, 2],
        pure: true,
        example: "contains([1, 2, 3], 2)",
        impl: (args, ctx) => {
            const val = args[0]!;
            const item = args[1]!;
            if (Array.isArray(val)) {
                return val.some((el) => ctx.isEqual(el, item));
            } else if (typeof val === "string") {
                return val.includes(String(item));
            }
            throw new RuntimeError("contains() requires an array or string", ctx.pos);
        },
    },
    {
        name: "index_of",
        sig: "index_of(val: list | str, item: any) -> int",
        doc: "returns index of item or -1",
        arity: [2, 2],
        pure: true,
        example: "index_of([10, 20, 30], 20)",
        impl: (args, ctx) => {
            const val = args[0]!;
            const item = args[1]!;
            if (Array.isArray(val)) {
                return val.findIndex((el) => ctx.isEqual(el, item));
            } else if (typeof val === "string") {
                return val.indexOf(String(item));
            }
            throw new RuntimeError("index_of() requires an array or string", ctx.pos);
        },
    },
    {
        name: "fill",
        sig: "fill(count: int, value: any) -> list",
        doc: "creates array of length count with value",
        arity: [2, 2],
        pure: true,
        example: "fill(3, 0)",
        impl: (args, ctx) => {
            const count = checkInteger(args[0]!, "fill() count", ctx.pos);
            if (count < 0) {
                throw new MemorySafetyError(`fill() requires a non-negative count: ${count}`, ctx.pos);
            }
            const val = args[1]!;
            const res: VmValue[] = [];
            for (let i = 0; i < count; i++) {
                res.push(Array.isArray(val) ? [...val] : val);
            }
            return res;
        },
    },
    {
        name: "sum",
        sig: "sum(arr: list) -> number",
        doc: "returns sum of all elements in numeric array",
        arity: [1, 1],
        pure: true,
        example: "sum([1, 2, 3])",
        impl: (args, ctx) => {
            const arr = checkArray(args[0]!, "sum()", ctx.pos);
            let total = 0;
            for (const item of arr) {
                if (typeof item !== "number") {
                    throw new RuntimeError(`sum() encountered non-numeric element '${typeof item}'`, ctx.pos);
                }
                total += item;
            }
            return total;
        },
    },
    {
        name: "min",
        sig: "min(...args: number | list) -> number",
        doc: "returns minimum number among arguments or in an array",
        arity: [1, 100],
        pure: true,
        example: "min(3, 1, 2)",
        impl: (args, ctx) => {
            if (args.length === 1 && Array.isArray(args[0])) {
                const arr = args[0];
                if (arr.length === 0) {
                    throw new RuntimeError("min() on empty array", ctx.pos);
                }
                let m = checkNumber(arr[0]!, "min() element", ctx.pos);
                for (let i = 1; i < arr.length; i++) {
                    const n = checkNumber(arr[i]!, "min() element", ctx.pos);
                    if (n < m) m = n;
                }
                return m;
            }
            let m = checkNumber(args[0]!, "min() argument", ctx.pos);
            for (let i = 1; i < args.length; i++) {
                const n = checkNumber(args[i]!, "min() argument", ctx.pos);
                if (n < m) m = n;
            }
            return m;
        },
    },
    {
        name: "max",
        sig: "max(...args: number | list) -> number",
        doc: "returns maximum number among arguments or in an array",
        arity: [1, 100],
        pure: true,
        example: "max(3, 1, 2)",
        impl: (args, ctx) => {
            if (args.length === 1 && Array.isArray(args[0])) {
                const arr = args[0];
                if (arr.length === 0) {
                    throw new RuntimeError("max() on empty array", ctx.pos);
                }
                let m = checkNumber(arr[0]!, "max() element", ctx.pos);
                for (let i = 1; i < arr.length; i++) {
                    const n = checkNumber(arr[i]!, "max() element", ctx.pos);
                    if (n > m) m = n;
                }
                return m;
            }
            let m = checkNumber(args[0]!, "max() argument", ctx.pos);
            for (let i = 1; i < args.length; i++) {
                const n = checkNumber(args[i]!, "max() argument", ctx.pos);
                if (n > m) m = n;
            }
            return m;
        },
    },
    {
        name: "pow",
        sig: "pow(base: number, exp: number) -> number",
        doc: "returns base raised to exp",
        arity: [2, 2],
        pure: true,
        example: "pow(2, 3)",
        impl: (args, ctx) => {
            const base = checkNumber(args[0]!, "pow() base", ctx.pos);
            const exp = checkNumber(args[1]!, "pow() exponent", ctx.pos);
            return Math.pow(base, exp);
        },
    },
    {
        name: "sqrt",
        sig: "sqrt(num: number) -> float",
        doc: "returns square root of non-negative number",
        arity: [1, 1],
        pure: true,
        example: "sqrt(16)",
        impl: (args, ctx) => {
            const n = checkNumber(args[0]!, "sqrt()", ctx.pos);
            if (n < 0) {
                throw new MemorySafetyError("Cannot calculate sqrt of negative number", ctx.pos);
            }
            return Math.sqrt(n);
        },
    },
    {
        name: "abs",
        sig: "abs(num: number) -> number",
        doc: "returns absolute value",
        arity: [1, 1],
        pure: true,
        example: "abs(-42)",
        impl: (args, ctx) => {
            const n = checkNumber(args[0]!, "abs()", ctx.pos);
            return Math.abs(n);
        },
    },
    {
        name: "floor",
        sig: "floor(num: number) -> int",
        doc: "rounds number down to integer",
        arity: [1, 1],
        pure: true,
        example: "floor(3.7)",
        impl: (args, ctx) => {
            const n = checkNumber(args[0]!, "floor()", ctx.pos);
            return Math.floor(n);
        },
    },
    {
        name: "ceil",
        sig: "ceil(num: number) -> int",
        doc: "rounds number up to integer",
        arity: [1, 1],
        pure: true,
        example: "ceil(3.2)",
        impl: (args, ctx) => {
            const n = checkNumber(args[0]!, "ceil()", ctx.pos);
            return Math.ceil(n);
        },
    },
    {
        name: "round",
        sig: "round(num: number, digits?: int) -> number",
        doc: "rounds number to nearest integer or decimal places",
        arity: [1, 2],
        pure: true,
        example: "round(3.5)",
        impl: (args, ctx) => {
            const n = checkNumber(args[0]!, "round()", ctx.pos);
            if (args.length > 1 && args[1] !== null) {
                const digits = checkInteger(args[1]!, "round() digits", ctx.pos);
                const factor = Math.pow(10, digits);
                return Math.round(n * factor) / factor;
            }
            return Math.round(n);
        },
    },
    {
        name: "sin",
        sig: "sin(num: number) -> float",
        doc: "returns sine of number (radians)",
        arity: [1, 1],
        pure: true,
        example: "sin(0)",
        impl: (args, ctx) => {
            const n = checkNumber(args[0]!, "sin()", ctx.pos);
            return Math.sin(n);
        },
    },
    {
        name: "cos",
        sig: "cos(num: number) -> float",
        doc: "returns cosine of number (radians)",
        arity: [1, 1],
        pure: true,
        example: "cos(0)",
        impl: (args, ctx) => {
            const n = checkNumber(args[0]!, "cos()", ctx.pos);
            return Math.cos(n);
        },
    },
    {
        name: "log",
        sig: "log(num: number, base?: number) -> float",
        doc: "returns natural logarithm or logarithm with given base",
        arity: [1, 2],
        pure: true,
        example: "log(1)",
        impl: (args, ctx) => {
            const n = checkNumber(args[0]!, "log()", ctx.pos);
            if (n <= 0) {
                throw new RuntimeError("log() of non-positive number", ctx.pos);
            }
            if (args.length > 1 && args[1] !== null) {
                const base = checkNumber(args[1]!, "log() base", ctx.pos);
                if (base <= 0 || base === 1) {
                    throw new RuntimeError("log() with invalid base", ctx.pos);
                }
                return Math.log(n) / Math.log(base);
            }
            return Math.log(n);
        },
    },
    {
        name: "gcd",
        sig: "gcd(a: int, b: int) -> int",
        doc: "returns greatest common divisor of a and b",
        arity: [2, 2],
        pure: true,
        example: "gcd(48, 18)",
        impl: (args, ctx) => {
            const a = checkInteger(args[0]!, "gcd() first argument", ctx.pos);
            const b = checkInteger(args[1]!, "gcd() second argument", ctx.pos);
            return gcdInt(a, b);
        },
    },
    {
        name: "lcm",
        sig: "lcm(a: int, b: int) -> int",
        doc: "returns least common multiple of a and b",
        arity: [2, 2],
        pure: true,
        example: "lcm(12, 18)",
        impl: (args, ctx) => {
            const a = checkInteger(args[0]!, "lcm() first argument", ctx.pos);
            const b = checkInteger(args[1]!, "lcm() second argument", ctx.pos);
            if (a === 0 || b === 0) return 0;
            return Math.abs(a * b) / gcdInt(a, b);
        },
    },
    {
        name: "split",
        sig: "split(str: str, delimiter: str) -> list",
        doc: "splits string by delimiter into list of strings",
        arity: [2, 2],
        pure: true,
        example: "split(\"a,b,c\", \",\")",
        impl: (args, ctx) => {
            const str = checkString(args[0]!, "split() first argument", ctx.pos);
            const delim = checkString(args[1]!, "split() delimiter", ctx.pos);
            return str.split(delim);
        },
    },
    {
        name: "join",
        sig: "join(arr: list, delimiter: str) -> str",
        doc: "joins list elements into string with delimiter",
        arity: [2, 2],
        pure: true,
        example: "join([\"a\", \"b\"], \",\")",
        impl: (args, ctx) => {
            const arr = checkArray(args[0]!, "join() first argument", ctx.pos);
            const delim = checkString(args[1]!, "join() delimiter", ctx.pos);
            return arr.map((item) => String(item)).join(delim);
        },
    },
    {
        name: "char_at",
        sig: "char_at(str: str, index: int) -> str",
        doc: "returns character at index in string",
        arity: [2, 2],
        pure: true,
        example: "char_at(\"hello\", 0)",
        impl: (args, ctx) => {
            const str = checkString(args[0]!, "char_at() string", ctx.pos);
            const idx = checkInteger(args[1]!, "char_at() index", ctx.pos);
            if (idx < 0 || idx >= str.length) {
                throw new MemorySafetyError(
                    `String index out of bounds: index ${idx}, length ${str.length}`,
                    ctx.pos
                );
            }
            return str[idx]!;
        },
    },
    {
        name: "to_int",
        sig: "to_int(val: any) -> int",
        doc: "converts value to integer",
        arity: [1, 1],
        pure: true,
        example: "to_int(\"42\")",
        impl: (args, ctx) => {
            const val = args[0]!;
            if (typeof val === "number") return Math.trunc(val);
            if (typeof val === "boolean") return val ? 1 : 0;
            if (typeof val === "string") {
                const parsed = parseInt(val, 10);
                if (isNaN(parsed)) {
                    throw new RuntimeError(`to_int() failed to parse '${val}' as integer`, ctx.pos);
                }
                return parsed;
            }
            throw new RuntimeError(`Cannot convert '${typeof val}' to int`, ctx.pos);
        },
    },
    {
        name: "to_float",
        sig: "to_float(val: any) -> float",
        doc: "converts value to float",
        arity: [1, 1],
        pure: true,
        example: "to_float(\"3.14\")",
        impl: (args, ctx) => {
            const val = args[0]!;
            if (typeof val === "number") return val;
            if (typeof val === "boolean") return val ? 1.0 : 0.0;
            if (typeof val === "string") {
                const parsed = parseFloat(val);
                if (isNaN(parsed)) {
                    throw new RuntimeError(`to_float() failed to parse '${val}' as float`, ctx.pos);
                }
                return parsed;
            }
            throw new RuntimeError(`Cannot convert '${typeof val}' to float`, ctx.pos);
        },
    },
    {
        name: "to_str",
        sig: "to_str(val: any) -> str",
        doc: "converts value to string",
        arity: [1, 1],
        pure: true,
        example: "to_str(42)",
        impl: (args) => {
            const val = args[0]!;
            if (val === null) return "null";
            if (typeof val === "boolean") return val ? "true" : "false";
            if (Array.isArray(val)) return `[${val.map((v) => String(v)).join(", ")}]`;
            return String(val);
        },
    },
    {
        name: "assert",
        sig: "assert(condition: bool, msg?: str) -> null",
        doc: "runtime safety check; throws error if condition is false",
        arity: [1, 2],
        pure: true,
        example: "assert(1 == 1, \"Math works\")",
        impl: (args, ctx) => {
            const cond = args[0]!;
            if (typeof cond !== "boolean") {
                throw new RuntimeError(
                    `assert() condition must be boolean, got '${typeof cond}'`,
                    ctx.pos
                );
            }
            if (!cond) {
                const msg = args.length > 1 && args[1] !== null ? String(args[1]) : "Assertion failed";
                throw new RuntimeError(`AssertionError: ${msg}`, ctx.pos);
            }
            return null;
        },
    },
    {
        name: "print",
        sig: "print(...args: any[]) -> null",
        doc: "outputs value(s) to standard output",
        arity: [1, 100],
        pure: false,
        example: "print(\"hello\")",
        impl: (args, ctx) => {
            for (const arg of args) {
                ctx.print(formatVmValue(arg));
            }
            return null;
        },
    },
    {
        name: "println",
        sig: "println(...args: any[]) -> null",
        doc: "outputs value(s) with newline to standard output",
        arity: [1, 100],
        pure: false,
        example: "println(\"hello\")",
        impl: (args, ctx) => {
            for (const arg of args) {
                ctx.print(formatVmValue(arg));
            }
            return null;
        },
    },
];

export const BUILTINS_MAP = new Map<string, Builtin>();
for (const b of BUILTINS) {
    BUILTINS_MAP.set(b.name, b);
}

export function formatVmValue(val: VmValue): string {
    if (val === null) return "null";
    if (typeof val === "boolean") return val ? "true" : "false";
    if (Array.isArray(val)) {
        return `[${val.map((v) => formatVmValue(v)).join(", ")}]`;
    }
    return String(val);
}
