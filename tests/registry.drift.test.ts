import { describe, expect, test } from "bun:test";
import { BUILTINS, BUILTINS_MAP } from "../src/stdlib/registry";
import { BUILTIN_LIBRARY } from "../src/ai/prompts/builtins";
import { Parser } from "../src/ir";
import { BytecodeCompiler, VirtualMachine } from "../src/vm";

describe("Registry & Prompt Drift Tests", () => {
    test("every builtin in registry has implementation, signature, doc, and example", () => {
        expect(BUILTINS.length).toBeGreaterThan(20);
        for (const b of BUILTINS) {
            expect(b.name).toBeDefined();
            expect(b.sig).toBeDefined();
            expect(b.doc).toBeDefined();
            expect(typeof b.impl).toBe("function");
            expect(b.example).toBeDefined();
            expect(BUILTINS_MAP.get(b.name)).toBe(b);
        }
    });

    test("system prompt contains every registered builtin name", () => {
        for (const b of BUILTINS) {
            expect(BUILTIN_LIBRARY).toContain(b.name);
        }
    });

    test("every builtin example compiles and executes successfully without crashing", () => {
        for (const b of BUILTINS) {
            const exampleCode = b.example.endsWith(";") ? b.example : `${b.example};`;
            try {
                const ast = new Parser(exampleCode).parse();
                const chunk = new BytecodeCompiler().compile(ast);
                const vm = new VirtualMachine();
                vm.run(chunk);
            } catch (err) {
                throw new Error(`Example for builtin '${b.name}' failed: '${b.example}' -> ${(err as Error).message}`);
            }
        }
    });
});
