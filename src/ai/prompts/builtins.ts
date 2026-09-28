import { BUILTINS } from "../../stdlib/registry";

export function generateBuiltinPrompt(): string {
    const lines = ["BUILT-IN FUNCTION LIBRARY:"];

    // Group built-ins
    const collections = ["len", "push", "pop", "swap", "slice", "reverse", "sort", "contains", "index_of", "fill", "sum"];
    const math = ["pow", "sqrt", "abs", "floor", "ceil", "round", "min", "max", "sin", "cos", "log", "gcd", "lcm"];
    const strings = ["split", "join", "char_at", "to_int", "to_float", "to_str"];
    const io = ["assert", "print", "println"];

    lines.push("1. Array & Collection Built-ins:");
    for (const name of collections) {
        const b = BUILTINS.find((x) => x.name === name);
        if (b) lines.push(`   - ${b.sig}: ${b.doc}`);
    }

    lines.push("\n2. Math Built-ins:");
    for (const name of math) {
        const b = BUILTINS.find((x) => x.name === name);
        if (b) lines.push(`   - ${b.sig}: ${b.doc}`);
    }

    lines.push("\n3. String & Conversion Built-ins:");
    for (const name of strings) {
        const b = BUILTINS.find((x) => x.name === name);
        if (b) lines.push(`   - ${b.sig}: ${b.doc}`);
    }

    lines.push("\n4. Output & Invariants:");
    for (const name of io) {
        const b = BUILTINS.find((x) => x.name === name);
        if (b) lines.push(`   - ${b.sig}: ${b.doc}`);
    }

    return lines.join("\n");
}

export const BUILTIN_LIBRARY = generateBuiltinPrompt();
