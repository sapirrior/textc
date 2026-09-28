export const FEW_SHOT_EXAMPLES = `EXAMPLES:

Input:
Numbers: 8, 3, 12, 2, 7
Find the minimum and maximum numbers, then print the sum of their squares.

Output:
let numbers = [8, 3, 12, 2, 7];
let min_val = min(numbers);
let max_val = max(numbers);
let result = pow(min_val, 2) + pow(max_val, 2);
println(result);

Input:
Numbers: 64, 34, 25, 12, 22, 11, 90
Sort the numbers and reverse them, then print.

Output:
mut arr = [64, 34, 25, 12, 22, 11, 90];
sort(arr);
reverse(arr);
println(arr);

Input:
Count Collatz conjecture steps starting at 27. Print each step.

Output:
mut n = 27;
mut steps = 0;
while n != 1 {
    println(n);
    if n % 2 == 0 {
        n = n / 2;
    } else {
        n = 3 * n + 1;
    }
    steps = steps + 1;
}
println(n);
println(steps);`;
