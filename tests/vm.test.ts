import { describe, expect, test } from "bun:test";
import { Parser } from "../src/ir";
import { BytecodeCompiler, VirtualMachine } from "../src/vm";

function execute(source: string): string {
    const ast = new Parser(source).parse();
    const chunk = new BytecodeCompiler().compile(ast);
    const vm = new VirtualMachine();
    return vm.run(chunk);
}

describe("Virtual Machine Execution & Operations", () => {
    test("arithmetic operations evaluation", () => {
        const out = execute(`
        let a = 10;
        let b = 3;
        print(a + b);
        print(a - b);
        print(a * b);
        print(a // b);
        print(a % b);
        print(a / 2);
        `);
        const lines = out.split("\n");
        expect(lines[0]).toBe("13");
        expect(lines[1]).toBe("7");
        expect(lines[2]).toBe("30");
        expect(lines[3]).toBe("3");
        expect(lines[4]).toBe("1");
        expect(lines[5]).toBe("5");
    });

    test("comparisons and logical operations", () => {
        const out = execute(`
        print(5 < 10);
        print(10 <= 10);
        print(20 > 50);
        print(30 >= 30);
        print(5 == 5);
        print(5 != 6);
        print(true and false);
        print(true or false);
        print(not false);
        `);
        const lines = out.split("\n");
        expect(lines[0]).toBe("true");
        expect(lines[1]).toBe("true");
        expect(lines[2]).toBe("false");
        expect(lines[3]).toBe("true");
        expect(lines[4]).toBe("true");
        expect(lines[5]).toBe("true");
        expect(lines[6]).toBe("false");
        expect(lines[7]).toBe("true");
        expect(lines[8]).toBe("true");
    });

    test("while loop with mutable accumulator", () => {
        const out = execute(`
        mut sum = 0;
        mut i = 1;
        while i <= 10 {
            sum = sum + i;
            i = i + 1;
        }
        print(sum);
        `);
        expect(out.trim()).toBe("55");
    });

    test("for-in loop over range", () => {
        const out = execute(`
        mut total = 0;
        for x in 0..5 {
            total = total + x;
        }
        print(total);
        `);
        expect(out.trim()).toBe("10"); // 0+1+2+3+4 = 10
    });

    test("for-in loop over array elements", () => {
        const out = execute(`
        let items = [10, 20, 30, 40];
        mut acc = 0;
        for item in items {
            acc = acc + item;
        }
        print(acc);
        `);
        expect(out.trim()).toBe("100");
    });

    test("array built-ins: sort, reverse, swap, slice, sum", () => {
        const out = execute(`
        mut nums = [50, 10, 40, 20, 30];
        sort(nums);
        print(nums);
        reverse(nums);
        print(nums);
        swap(nums, 0, 4);
        print(nums);
        let sub = slice(nums, 1, 4);
        print(sub);
        print(sum(nums));
        `);
        const lines = out.split("\n");
        expect(lines[0]).toBe("[10, 20, 30, 40, 50]");
        expect(lines[1]).toBe("[50, 40, 30, 20, 10]");
        expect(lines[2]).toBe("[10, 40, 30, 20, 50]");
        expect(lines[3]).toBe("[40, 30, 20]");
        expect(lines[4]).toBe("150");
    });

    test("math built-ins: sqrt, pow, abs, min, max, floor, ceil, round", () => {
        const out = execute(`
        print(sqrt(81));
        print(pow(2, 8));
        print(abs(-42));
        print(min(15, 99));
        print(max(15, 99));
        print(floor(3));
        print(ceil(3));
        print(round(7));
        `);
        const lines = out.split("\n");
        expect(lines[0]).toBe("9");
        expect(lines[1]).toBe("256");
        expect(lines[2]).toBe("42");
        expect(lines[3]).toBe("15");
        expect(lines[4]).toBe("99");
    });

    test("user-defined functions with return values", () => {
        const out = execute(`
        fn multiply_and_add(a, b, c) {
            return (a * b) + c;
        }
        let res = multiply_and_add(6, 7, 8);
        print(res);
        `);
        expect(out.trim()).toBe("50");
    });
});
