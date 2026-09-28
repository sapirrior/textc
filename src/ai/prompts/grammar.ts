export const GRAMMAR_RULES = `TEXTC IR GRAMMAR RULES:
1. Declarations:
   - Immutable variable: let x = 10;
   - Mutable variable (MANDATORY for any variable modified/reassigned later): mut count = 0;
   - Immutable array: let arr = [1, 2, 3];
   - Mutable array (MANDATORY if elements or length will change): mut arr = [1, 2, 3];
2. Assignment:
   - count = count + 1;
   - arr[i] = 42;
3. Control Flow:
   - if condition { ... } else { ... }
   - while condition { ... }
   - for x in arr { ... }
   - for i in 0..n { ... }
   - break;
   - continue;
4. Functions:
   - fn name(arg1, arg2) { ... return value; }
5. Operators:
   - Arithmetic: + (add), - (sub), * (mul), / (true division), // (floor division), % (floored modulo), ** (power)
   - Comparisons: ==, !=, <, <=, >, >=
   - Logical: and, or, not (conditions MUST be boolean)
   - Comments: # comment or /* block comment */
   - Statements: Every statement MUST end with a semicolon (;)

IMPORTANT MUTABILITY RULE:
Every variable that is updated, reassigned, or incremented in a loop or branch MUST be declared with 'mut' (e.g. 'mut current = 6;', 'mut steps = 0;', 'mut sum = 0;').`;
