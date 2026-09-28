import { describe, expect, test } from "bun:test";
import { Parser } from "../src/ir";
import { BytecodeCompiler, Chunk, BytecodeCompilationError } from "../src/vm";

describe("Bytecode Compiler & .txtc Serialization", () => {
    test("compiles program AST to chunk with correct instructions", () => {
        const source = `
        let a = 42;
        mut b = 10;
        let c = a + b;
        `;
        const ast = new Parser(source).parse();
        const compiler = new BytecodeCompiler();
        const chunk = compiler.compile(ast);

        expect(chunk.instructions.length).toBeGreaterThan(0);
        expect(chunk.constants).toContain(42);
        expect(chunk.constants).toContain(10);
        expect(chunk.constants).toContain("a");
        expect(chunk.constants).toContain("b");
    });

    test("encodes chunk into valid binary .txtc format with magic header", () => {
        const source = `
        mut count = 0;
        while count < 5 {
            count = count + 1;
        }
        `;
        const ast = new Parser(source).parse();
        const chunk = new BytecodeCompiler().compile(ast);
        const encoded = chunk.encode();

        expect(encoded.length).toBeGreaterThan(10);
        // Header: TXTC (0x54 0x58 0x54 0x43)
        expect(encoded.subarray(0, 4).toString("ascii")).toBe("TXTC");
        // Version: 1
        expect(encoded.readUInt16BE(4)).toBe(1);
    });

    test("decodes binary .txtc format back into Chunk lossless", () => {
        const source = `
        mut arr = [1, 2, 3];
        push(arr, 4);
        print(len(arr));
        `;
        const ast = new Parser(source).parse();
        const compiler = new BytecodeCompiler();
        const chunk = compiler.compile(ast);
        const encoded = chunk.encode();

        const decoded = Chunk.decode(encoded);
        expect(decoded.instructions.length).toBe(chunk.instructions.length);
        expect(decoded.constants.length).toBe(chunk.constants.length);
    });

    test("rejects invalid magic headers in .txtc files", () => {
        const invalidBuffer = Buffer.from("BAD_HEADER_DATA_1234");
        expect(() => Chunk.decode(invalidBuffer)).toThrow(BytecodeCompilationError);
    });

    test("rejects truncated .txtc buffers", () => {
        const truncated = Buffer.from("TX");
        expect(() => Chunk.decode(truncated)).toThrow(BytecodeCompilationError);
    });
});
