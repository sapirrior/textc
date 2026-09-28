import { describe, expect, test } from "bun:test";
import { Parser } from "../src/ir";
import { BytecodeCompiler, VirtualMachine, MemorySafetyError } from "../src/vm";

function runCode(source: string): string {
    const ast = new Parser(source).parse();
    const chunk = new BytecodeCompiler().compile(ast);
    const vm = new VirtualMachine();
    return vm.run(chunk);
}

describe("Guaranteed Memory Safety & Invariant Tests", () => {
    test("rejects mutation of immutable variable declared with 'let'", () => {
        const source = `
        let immutable_score = 95
        immutable_score = 100
        `;
        expect(() => runCode(source)).toThrow(MemorySafetyError);
    });

    test("rejects array out of bounds read", () => {
        const source = `
        let arr = [10, 20, 30]
        let x = arr[99]
        `;
        expect(() => runCode(source)).toThrow(MemorySafetyError);
    });

    test("rejects array out of bounds mutation", () => {
        const source = `
        mut arr = [10, 20, 30]
        arr[5] = 99
        `;
        expect(() => runCode(source)).toThrow(MemorySafetyError);
    });

    test("rejects division by zero", () => {
        const source = `
        let a = 10
        let b = 0
        let c = a / b
        `;
        expect(() => runCode(source)).toThrow(MemorySafetyError);
    });

    test("rejects modulo by zero", () => {
        const source = `
        let a = 10
        let b = 0
        let c = a % b
        `;
        expect(() => runCode(source)).toThrow(MemorySafetyError);
    });

    test("rejects sqrt of negative number", () => {
        const source = `
        let val = sqrt(-16)
        `;
        expect(() => runCode(source)).toThrow(MemorySafetyError);
    });

    test("rejects popping from an empty array", () => {
        const source = `
        mut arr = []
        pop(arr)
        `;
        expect(() => runCode(source)).toThrow(MemorySafetyError);
    });

    test("rejects invalid swap indices", () => {
        const source = `
        mut arr = [1, 2, 3]
        swap(arr, 0, 10)
        `;
        expect(() => runCode(source)).toThrow(MemorySafetyError);
    });
});
