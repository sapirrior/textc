import { describe, expect, test } from "bun:test";
import { Parser, ParseError } from "../../src/ir";
import { BytecodeCompiler, VirtualMachine, RuntimeError, BytecodeCompilationError, MemorySafetyError } from "../../src/vm";

function execute(source: string): string {
    const ast = new Parser(source).parse();
    const chunk = new BytecodeCompiler().compile(ast);
    const vm = new VirtualMachine();
    return vm.run(chunk);
}

describe("Phase 1 Regression Tests (Defects D1-D31)", () => {
    test("D1: Prompt/VM builtin drift - gcd, lcm, min(arr), max(arr), sin, cos, log, to_int, to_str, assert", () => {
        const out = execute(`
            print(gcd(48, 18));
            print(lcm(12, 18));
            print(min([3, 1, 2]));
            print(max([3, 1, 2]));
            print(to_int("42"));
            print(to_str(100));
            print(sin(0));
            print(cos(0));
            print(log(1));
            assert(true, "assertion passed");
        `);
        const lines = out.trim().split("\n");
        expect(lines[0]).toBe("6");
        expect(lines[1]).toBe("36");
        expect(lines[2]).toBe("1");
        expect(lines[3]).toBe("3");
        expect(lines[4]).toBe("42");
        expect(lines[5]).toBe("100");
        expect(lines[6]).toBe("0");
        expect(lines[7]).toBe("1");
        expect(lines[8]).toBe("0");
    });

    test("D2: Division is true division and // is floor division", () => {
        const out = execute(`
            print(7 / 2);
            print(7 // 2);
            print(-7 // 3);
            print(1 / 2);
        `);
        const lines = out.trim().split("\n");
        expect(lines[0]).toBe("3.5");
        expect(lines[1]).toBe("3");
        expect(lines[2]).toBe("-3");
        expect(lines[3]).toBe("0.5");
    });

    test("D3: sqrt returns exact float", () => {
        const out = execute(`
            print(sqrt(2));
            print(sqrt(9));
        `);
        const lines = out.trim().split("\n");
        expect(parseFloat(lines[0]!)).toBeCloseTo(Math.SQRT2, 5);
        expect(lines[1]).toBe("3");
    });

    test("D4: continue inside for-loop terminates correctly", () => {
        const out = execute(`
            mut acc = 0;
            for i in 0..5 {
                if i == 2 {
                    continue;
                }
                acc = acc + i;
            }
            print(acc);
        `);
        // 0 + 1 + 3 + 4 = 8
        expect(out.trim()).toBe("8");
    });

    test("D9: and/or short-circuit without executing right-hand side on early exit", () => {
        const out = execute(`
            let arr = [1, 2];
            let cond1 = false and (arr[10] == 1);
            let cond2 = true or (arr[10] == 1);
            print(cond1);
            print(cond2);
        `);
        const lines = out.trim().split("\n");
        expect(lines[0]).toBe("false");
        expect(lines[1]).toBe("true");
    });

    test("D10: Conditions must be boolean (truthiness rejects numbers/strings)", () => {
        expect(() => execute(`if 0 { print(1); }`)).toThrow(RuntimeError);
        expect(() => execute(`if "text" { print(1); }`)).toThrow(RuntimeError);
        expect(() => execute(`let x = not 0;`)).toThrow(RuntimeError);
    });

    test("D11: Comparison handles strings by Unicode code point order", () => {
        const out = execute(`
            print("a" < "b");
            print("abc" < "abd");
            print("apple" >= "apple");
        `);
        const lines = out.trim().split("\n");
        expect(lines[0]).toBe("true");
        expect(lines[1]).toBe("true");
        expect(lines[2]).toBe("true");
    });

    test("D12: sort on mixed types throws error", () => {
        expect(() => execute(`mut a = [1, "a", 3]; sort(a);`)).toThrow(RuntimeError);
    });

    test("D13: Number literal lexing (scientific notation, hex, binary, underscores)", () => {
        const out = execute(`
            print(1e3);
            print(2.5e-1);
            print(1_000_000);
            print(0x1f);
            print(0b1011);
        `);
        const lines = out.trim().split("\n");
        expect(lines[0]).toBe("1000");
        expect(lines[1]).toBe("0.25");
        expect(lines[2]).toBe("1000000");
        expect(lines[3]).toBe("31");
        expect(lines[4]).toBe("11");
    });

    test("D16: Non-integer float index is rejected", () => {
        expect(() => execute(`let a = [1, 2, 3]; print(a[1.5]);`)).toThrow(RuntimeError);
    });

    test("D17: Negative index throws MemorySafetyError and slice clamps without negative wrapping", () => {
        expect(() => execute(`let a = [1, 2, 3]; print(a[-1]);`)).toThrow(MemorySafetyError);
        const out = execute(`
            let a = [10, 20, 30, 40];
            print(slice(a, -2, 3));
        `);
        expect(out.trim()).toBe("[10, 20, 30]");
    });

    test("D22: Arity checking at compile-time and run-time", () => {
        expect(() => execute(`
            fn add(a, b) { return a + b; }
            add(1);
        `)).toThrow(BytecodeCompilationError);

        expect(() => execute(`
            fn add(a, b) { return a + b; }
            add(1, 2, 3);
        `)).toThrow(BytecodeCompilationError);
    });

    test("D24: return at top level is rejected at compile time", () => {
        expect(() => execute(`let x = 1; return x;`)).toThrow(BytecodeCompilationError);
    });

    test("D26: Unterminated string, lone '.', and '!' operator without '=' are rejected", () => {
        expect(() => new Parser(`"unterminated`).parse()).toThrow(ParseError);
        expect(() => new Parser(`.`).parse()).toThrow(ParseError);
        expect(() => new Parser(`!true`).parse()).toThrow(ParseError);
    });

    test("D27: Unicode identifiers are supported", () => {
        const out = execute(`
            let π = 3.14159;
            let é_val = 42;
            print(é_val);
        `);
        expect(out.trim()).toBe("42");
    });

    test("D28: Power operator ** is supported", () => {
        const out = execute(`
            print(2 ** 3);
            print(2 ** 3 ** 2); # right associative: 2 ** (3 ** 2) = 2 ** 9 = 512
        `);
        const lines = out.trim().split("\n");
        expect(lines[0]).toBe("8");
        expect(lines[1]).toBe("512");
    });

    test("D29: Trailing commas and empty statements are supported", () => {
        const out = execute(`
            let a = [1, 2, 3,];
            ;;;
            fn test_fn(x, y,) {
                return x + y;
            }
            let res = test_fn(10, 20,);
            print(res);
        `);
        expect(out.trim()).toBe("30");
    });

    test("D30: Missing semicolons are rejected with ParseError", () => {
        expect(() => new Parser(`let a = 1\nlet b = 2`).parse()).toThrow(ParseError);
    });

    test("D31: Chained comparisons are rejected at parse time with hint", () => {
        expect(() => new Parser(`let res = 1 < 2 < 3;`).parse()).toThrow(ParseError);
    });
});
