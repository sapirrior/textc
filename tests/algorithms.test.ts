import { describe, expect, test } from "bun:test";
import { Parser } from "../src/ir";
import { BytecodeCompiler, VirtualMachine } from "../src/vm";

function run(source: string): string {
    const ast = new Parser(source).parse();
    const chunk = new BytecodeCompiler().compile(ast);
    const vm = new VirtualMachine();
    return vm.run(chunk);
}

describe("Deep Algorithmic Correctness Tests", () => {
    test("Fibonacci dynamic sequence generator", () => {
        const source = `
        mut fib = [0, 1];
        mut i = 2;
        while i < 10 {
            let next_fib = fib[i - 1] + fib[i - 2];
            push(fib, next_fib);
            i = i + 1;
        }
        print(fib);
        `;
        const out = run(source);
        expect(out.trim()).toBe("[0, 1, 1, 2, 3, 5, 8, 13, 21, 34]");
    });

    test("Collatz conjecture steps calculation for 27", () => {
        const source = `
        mut n = 27;
        mut steps = 0;
        while n != 1 {
            if n % 2 == 0 {
                n = n // 2;
            } else {
                n = 3 * n + 1;
            }
            steps = steps + 1;
        }
        print(steps);
        `;
        const out = run(source);
        expect(out.trim()).toBe("111");
    });

    test("Bubble sort implementation in pure TextC IR", () => {
        const source = `
        mut arr = [64, 34, 25, 12, 22, 11, 90];
        mut n = len(arr);
        mut i = 0;
        while i < n - 1 {
            mut j = 0;
            while j < n - i - 1 {
                if arr[j] > arr[j + 1] {
                    swap(arr, j, j + 1);
                }
                j = j + 1;
            }
            i = i + 1;
        }
        print(arr);
        `;
        const out = run(source);
        expect(out.trim()).toBe("[11, 12, 22, 25, 34, 64, 90]");
    });

    test("Binary search algorithm", () => {
        const source = `
        let arr = [10, 20, 30, 40, 50, 60, 70, 80, 90];
        let target = 70;
        mut low = 0;
        mut high = len(arr) - 1;
        mut found_idx = -1;

        while low <= high {
            let mid = low + (high - low) // 2;
            if arr[mid] == target {
                found_idx = mid;
                break;
            } else if arr[mid] < target {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        print(found_idx);
        `;
        const out = run(source);
        expect(out.trim()).toBe("6"); // Index of 70 is 6
    });

    test("Palindrome array checker", () => {
        const source = `
        let letters = [1, 2, 3, 2, 1];
        mut is_pal = true;
        mut left = 0;
        mut right = len(letters) - 1;
        while left < right {
            if letters[left] != letters[right] {
                is_pal = false;
                break;
            }
            left = left + 1;
            right = right - 1;
        }
        print(is_pal);
        `;
        const out = run(source);
        expect(out.trim()).toBe("true");
    });

    test("Vector dot product calculation", () => {
        const source = `
        let v1 = [1, 3, -5];
        let v2 = [4, -2, -1];
        mut dot_product = 0;
        for i in 0..len(v1) {
            dot_product = dot_product + (v1[i] * v2[i]);
        }
        print(dot_product);
        `;
        const out = run(source);
        // (1*4) + (3*-2) + (-5*-1) = 4 - 6 + 5 = 3
        expect(out.trim()).toBe("3");
    });
});
