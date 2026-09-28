# textc v1.0 — IR + VM Redesign Plan

Audience: the coder agent that will implement this. Every claim marked **[V]** was verified
by reading the snapshot or by executing the extracted `src/ir` + `src/vm` code with `tsx`
(probe results are quoted). Nothing is assumed. Items marked **[DECISION]** are design choices
with reasons, not facts.

---

## 0. Goal, and what "done" means

**Goal:** natural language or pseudocode becomes runnable, deterministic, with no
language-specific pitfalls for algorithmists, researchers and data analysts.

**Design thesis:** a *tiny, orthogonal core* (few keywords, few opcodes) plus a *fixed,
versioned standard library* that the AI can name reliably. The core stays small so the
model rarely hallucinates syntax. The library carries the domain power.

**Done when:**
1. Every defect in §2 has a regression test that fails on the old code and passes on the new.
2. The AI prompt, the compiler, the VM and the docs are generated from **one** builtin
   registry (§4.3). A drift test fails CI if they disagree. (Today they disagree; see D1.)
3. `.txtc` is a real binary format with a verifier; hostile bytecode cannot crash the host (§6).
4. All ten `examples/*.txt` compile (with a stub/recorded AI) and produce the expected output.

---

## 1. What exists today (verified)

Pipeline: `input.txt → LLM → IR text → Lexer → Parser → AST → BytecodeCompiler → Chunk → VM`. **[V]**

| Layer | Files | Notes |
|---|---|---|
| Lexer | `src/ir/lexer.ts` | 16 keywords, `//` and `#` comments |
| Parser | `src/ir/parser.ts` | recursive descent, precedence climbing |
| AST | `src/ir/ast.ts` | 10 expr kinds, 11 stmt kinds |
| Compiler | `src/vm/compiler.ts` | stack bytecode, ~50 opcodes in `opcodes.ts` |
| VM | `src/vm/vm.ts` | tree of `CallFrame`s, `Map` environments, 5,000,000 step cap |
| AI | `src/ai/*` | one `chat.completions.create` call, no retry, no `temperature`, no validation loop **[V]** |
| Binary | `src/vm/chunk.ts` | header `TXTC` + u16 version + u32 length + **JSON text** **[V]** |

Only dependency: `openai@^7.23.0`. Build/test runner is **Bun** (`bun test`); tsx was used
here only for probing. **[V]**

**Keep:** stack VM, `let`/`mut` split, position tracking on every instruction, step limit,
the bounds-checked `MemorySafetyError` idea, `TEXTC_ERROR` protocol, `--emit-ir`.

---

## 2. Verified defects (each needs a regression test)

Format: **ID — symptom — evidence — root cause (file:area) — fix section.**

### Correctness (wrong answers silently) — highest priority for a "100% exact" tool

- **D1 Prompt/VM builtin drift.** The prompt advertises `gcd lcm split join char_at to_int
  to_float to_str assert`, plus `min(arr)`/`max(arr)`. Probes: `gcd`, `to_int`, `assert` →
  `Undefined function`; `min([3,1,2])` → `Expected number, got 'object'`. Also the prompt says
  `fill(count, value)`, which matches the VM. `sin`, `cos`, `log` are routed by the compiler
  to `OP_MATH_CALL` but the VM's `executeMath` only has `sqrt abs min max floor ceil round pow`
  → `Unknown math function 'sin'`. Root cause: three hand-maintained lists
  (`prompts/builtins.ts`, the `if/else` chain in `compiler.ts`, `executeMath` in `vm.ts`).
  **Fix: §4.3.**
- **D2 Division is floor division.** `7/2 → 3`, `-7/2 → -4`, `1/3 → 0` **[V]**. `vm.ts`
  `OP_DIV` does `Math.floor(a / b)`. Every mean/variance/probability/finance result is wrong.
  The README's own example ("average … 84") only works because of this. **Fix: §3.3.**
- **D3 `sqrt` truncates.** `vm.ts` pushes `Math.floor(Math.sqrt(n))`. **Fix: §3.3.**
- **D4 `continue` inside `for` never terminates.** `for i in 0..5 { if i==2 { continue; } … }`
  → step-limit error. Proof: the emitted `OP_LOOP` targets instruction 4, which is
  `loopStart` (the condition check), skipping the increment **[V]**. Cause: `compiler.ts`
  ForStatement sets `continueTarget = loopStart` and only reassigns it *after* compiling the
  body, but `ContinueStatement` reads it during body compilation. `while`+`continue` is fine
  (target is the condition). **Fix: §5.4** (forward-patched continue list).
- **D5 Reference aliasing.** `mut a=[1,2]; let b=a; push(b,3); println(a)` → `[1, 2, 3]`;
  `fn m(x){x[0]=99}` mutates the caller's array; `fill(2, [])` yields two references to the
  same inner array (`[[1],[1]]`) **[V]**. Intent is unclear to an AI and a common source of
  algorithm bugs. **Fix: §3.4** (value semantics).
- **D6 `let` does not mean immutable for arrays.** `let a=[1,2]; a[0]=9` succeeds **[V]**.
  Contradicts the README ("never corrupt memory") and the prompt rule. **Fix: §3.4.**
- **D7 No block scoping.** `if true { let x=1; } println(x)` prints `1` **[V]** (one flat
  environment per frame). `let a=1; let a=2` silently redefines. **Fix: §5.2.**
- **D8 Functions cannot be declared after use** (hoisting): `println(f()); fn f(){…}` →
  `Undefined function 'f'` **[V]**. Natural-language algorithms routinely list helpers last.
  **Fix: §5.5** (hoist function declarations).
- **D9 `and`/`or` do not short-circuit.** `false and a[5]==1` evaluates the right side and
  raises out-of-bounds **[V]**. Guard idioms (`i < n and a[i] > x`) crash. `OP_JUMP_IF_TRUE`
  exists but is never emitted. **Fix: §5.3.**
- **D10 Truthiness leaks JS-isms.** `isTruthy` treats `0` and `""` as false. `1==true` is
  `false` while `1 and 1` is `true` **[V]**. **Fix: §3.2** (conditions must be `bool`).
- **D11 Comparison cannot handle strings.** `"a" < "b"` → `Expected number, got 'string'`
  **[V]**, yet `sort` uses `localeCompare` for strings (locale-dependent, non-deterministic
  across machines). **Fix: §3.2, §4.**
- **D12 `sort` on mixed types** returns `[1, 3, a]` **[V]** (comparator falls back to
  `String()`), so a data error is masked. **Fix: §4.**
- **D13 Number literal lexing.** `1e3` and `1e9` fail with a confusing
  `Expected ')' after arguments` (lexed as `1` then identifier `e3`) **[V]**. Scientific
  notation is basic for researchers. **Fix: §5.1.**
- **D14 Integers above 2^53 lose precision:** `9007199254740993 → 9007199254740992` **[V]**.
  "100% exact" is false for factorials, Fibonacci(100), modular arithmetic. **Fix: §3.1.**
- **D15 `NaN`/`-0`/`Infinity`** can be produced (`0*1/1==0` fine, but `float mod` gives `1.5`,
  `Infinity` reachable through `pow`); `addConstant` dedups with `===`, which merges `0`/`-0`
  and never dedups `NaN`. **Fix: §3.1, §6.2.**
- **D16 Index accepts floats:** `[1,2,3][1.5]` → `"undefined"` printed as text **[V]**, a
  silent bug. **Fix: §3.3.**
- **D17 Negative indexing/slice semantics undefined:** `[..][-1]` is an error but
  `slice(a,-2,3)` silently wraps (JS `slice`) **[V]**. One rule needed. **Fix: §4.2.**
- **D18 Range semantics are half-open but undocumented to the model** (`0..3` → 0,1,2)
  **[V]**; descending ranges silently run zero times. The prompt shows `for i in 0..n`
  only. **Fix: §5.4** (explicit `..` vs `..=`, and `step`).
- **D19 Loop variable is assignable and affects iteration:** `for i in 0..5 { i=i+1; … }`
  prints `1 3 5` **[V]**. **Fix: §5.4** (loop variable immutable).
- **D20 Array iteration while mutating the array** (`push` inside `for x in a`) yields
  implementation-defined results **[V]** (`[1, 2, 1, 2, 1]`). **Fix: §5.4** (iterate a snapshot).
- **D21 Generated names collide:** synthetic names `__end_<var>_<line>` / `__arr_…` / `__idx_…`
  are keyed by *line number*; two `for i` loops on one line share slots. Works today by luck
  because each is defined before use **[V]**, but nested same-line loops over the same var
  rely on ordering. Also these names live in the user's namespace. **Fix: §5.4** (hidden
  slot indices, no name-based temps).

### Calls and stack (crash / corruption class)

- **D22 Arity is not checked.** `f(1)` for `f(a,b)` → `Stack underflow` (an internal error, not
  a user error); `f(1,2)` for `f(a)` silently returns and **leaks a stack slot** **[V]**.
  **Fix: §5.5** (compile-time and run-time arity check).
- **D23 No recursion depth limit.** `f(100000)` succeeded; only the 5M step cap stops
  runaway recursion **[V]**, and in a real host a large step budget with deep frames grows
  memory unboundedly. **Fix: §6.3** (frame limit + heap limit).
- **D24 `return` at top level is accepted** and ends the program silently **[V]**. **Fix:
  §5.5.**
- **D25 Functions are not closures, and there is no lexical scope check.** A callee cannot see a
  caller's locals (good, `dynamic scope leak` errored **[V]**), but it *can* read/write
  globals, and `fn h(){ g=5 }` mutates a global `g` **[V]**. This is hidden global state,
  which is bad for a "pure, deterministic" claim. **Fix: §5.5** (functions see only their
  parameters, their locals, and top-level `let` constants and functions).

### Lexer/parser robustness

- **D26 Lexer accepts junk silently.** Unterminated string `"abc` is accepted and swallows
  the rest of the file (error surfaces later at an unrelated place) **[V]**; a lone `.` throws
  a plain `Error`, not a `ParseError` with a hint **[V]**; `!` maps to `not`, so `!true`
  works but `!x == y` precedence is ambiguous **[V]**. **Fix: §5.1.**
- **D27 Identifiers are ASCII-only:** `let é=1` → `Unexpected character` **[V]**. Data
  analysts name columns in their own language. **Fix: §5.1** (Unicode identifiers).
- **D28 No `**` operator** (`2**3` → `ParseError`) **[V]**; pseudocode uses `^`, `**`, and
  "to the power". **Fix: §5.1, §3.3.**
- **D29 Trailing commas and `;;` are errors** **[V]**; LLMs emit both. **Fix: §5.1.**
- **D30 Newlines are insignificant, so `let a=1⏎(2)` parses as a call** and errors with
  `Can only call named functions` **[V]**. Semicolons are optional in the parser but
  mandatory in effect. **Fix: §5.1** (explicit `;`, mandatory).
- **D31 Chained comparison** `1<2<3` fails at runtime with a type error **[V]**. **Fix:
  §5.3** (reject at compile time with a hint, or support it).
- **D32 `range` is parsed as an expression** at the lowest precedence and then rejected by the
  compiler outside `for` **[V]** (`let r=0..3` → compile error). No first-class range.
  **Fix: §5.4** (ranges are a `for`-only construct; `range(a,b)` builtin for values).

### Binary format / security

- **D33 `.txtc` is JSON in a header** **[V]**: a 30-instruction program (the 4-line Fibonacci loop) encodes to **1550
  bytes** because every `Instruction` carries a full `{op, operand, pos:{line,column}}`
  object. Not compact, not really binary. **Fix: §6.1.**
- **D34 `decode` does not verify length, checksum, or bytecode validity.** A truncated file
  yields a raw `SyntaxError: Unexpected end of JSON input` **[V]**; a forged program with an
  out-of-range jump target decodes and runs (silently ends) **[V]**; constants can name any
  variable (e.g. `__proto__`) **[V]**. Version is hard-coded to `1` in both encode and decode
  **[V]** (`chunk.ts`), ignoring `TEXTC_BYTECODE_VERSION` in `constants/index.ts`. **Fix:
  §6.2.**
- **D35 Errors lose position after `.txtc` compile:** function instructions store `pos`, but
  `.txtc` runs report `file:1:1` in `main.ts` for non-VM errors **[V]** (the fallback
  branch). **Fix: §6.4** (source map section).

### AI integration

- **D36 One-shot generation, no verification loop.** `runner.ts` calls the model once,
  strips a leading fence, then parses. A parse or type error is fatal (`process.exit(1)`)
  with no repair attempt **[V]**. No `temperature: 0`, no `seed` **[V]**, so the same input can
  produce different programs. **Fix: §7.**
- **D37 Errors call `process.exit` deep inside library code** (`generate`), making it
  untestable and unusable as a library **[V]**. **Fix: §7.4.**
- **D38 Data is re-typed by the model.** The model copies user data into literals, so a
  1,000-row dataset costs tokens and risks transcription errors. There is no way to pass
  data that the model does not see. **Fix: §8.**
- **D39 Only the first error is reported** by parse/compile. An AI repair loop wants *all*
  diagnostics at once. **Fix: §5.6, §7.2.**

### Not verified (do not act on these without checking)

- Windows installer behaviour, release workflow correctness, `package-lock.json` health:
  read but **not executed**; out of scope for this plan.
- Behaviour of the real LLM on any prompt: **no model was called**. Every AI-side claim in
  §7 is a design decision; §10 defines how to measure it.

---

## 3. Core semantic decisions (the contract)

These are the rules the whole system is built on. Write them into `docs/SEMANTICS.md` and
into the model prompt verbatim (short form).

### 3.1 Numbers **[DECISION]**

Two numeric types, never implicitly mixed into silent loss:

- `int`: arbitrary-precision integer (JS `BigInt` internally). Fixes D14.
- `float`: IEEE-754 binary64. `NaN` and `±Infinity` are **not values**: any operation that
  would produce them raises `MathError` (fixes D15). `-0` normalises to `0`.

Literal rules: `42` is `int`; `4.2`, `1e3`, `2.5e-3` are `float`; `1_000_000` allowed.
Rationale: an algorithmist expects `7/2` to be `3.5` and `2**100` to be exact. The two types
cover both without a "decimal" tower.

Optional (Phase 4): `decimal` for finance (`decimal("0.1") + decimal("0.2") == decimal("0.3")`).
Not core, because rounding modes make it a large surface. Ship only if a real user asks.

### 3.2 Types and truthiness **[DECISION]**

Types: `int float bool str list map null` (see §3.5 for `map`). Functions are not values.

- Conditions in `if`/`while`/`and`/`or`/`not` **must be `bool`**. `if 0 {}` is a compile-time
  or run-time `TypeError` with hint "compare explicitly: `x != 0`". Fixes D10. LLMs write
  `if len(a)` all the time; a loud, hinted error is better than a silent wrong branch, and the
  repair loop (§7) fixes it automatically.
- `==` compares by structure for `list`/`map`, by value for scalars. `1 == 1.0` is `true`
  (numeric equality across int/float); `1 == true` is `false`.
- Ordering (`< <= > >=`) is defined for `int`/`float` (mixed OK), and `str`/`str` by **Unicode
  code point order** (never `localeCompare`). Everything else is `TypeError`. Fixes D11.

### 3.3 Arithmetic **[DECISION]**

| Op | int,int | any float involved |
|---|---|---|
| `/` | **true division → float** | float |
| `//` | floor division → int (divisor 0 → `MathError`) | floor, then float |
| `%` | **floored modulo** (sign follows divisor: `-7 % 3 == 2`), divisor 0 → `MathError` | same |
| `**` | int if exponent ≥ 0, else float; huge exponents guarded (§6.3) | float |
| `+ - *` | exact int | float |

Fixes D2 and D28, and makes `%` match mathematical convention instead of JS (`-7%3 → -1`
today **[V]**). `sqrt(x)` returns float; `isqrt(n)` returns exact int (fixes D3).
`x[i]` requires `int` index (fixes D16). Negative indexes are **not** wrapped (one rule,
D17); use `a[len(a)-1]` or `last(a)`.

### 3.4 Value semantics **[DECISION]**

`list` and `map` are **values**. Assignment, argument passing and `return` copy logically
(implement with copy-on-write / persistent structure so it stays O(1) amortised; do not
deep-copy eagerly). Consequences:

- `let b = a` then mutating `b` never changes `a` (fixes D5).
- Functions cannot mutate caller data. To update, return the new value:
  `a = sorted(a)`.
- `let` means deeply immutable, including element assignment (fixes D6):
  `let a=[1,2]; a[0]=9` → `ImmutableError`.
- `fill(2, [])` produces independent inner lists (fixes D5 sub-case).

This is the single most important AI-safety choice: the model never has to reason about
aliasing. Cost: in-place algorithms (bubble sort, in-place swap) are written as
`a[i], a[j] = a[j], a[i]` on a `mut` list, which is still O(1) per swap under COW because the
list is uniquely owned. **Decision to confirm with the owner:** if in-place *builtins* like
`sort(arr)` mutating are wanted (current behaviour), the alternative is "mutating builtins
return `null` and end in `!`"; this plan chooses **pure builtins** (`sorted`, `reversed`) and
in-place forms only via index assignment, because pure functions are what an LLM gets right
most often.

### 3.5 Minimal data types beyond list **[DECISION]**

Add `map` (string/int keys, insertion-ordered, deterministic iteration) and `str` as an
indexable, immutable sequence of code points. `set` is a library over `map` (§4). Nothing
else. Tuples/records: use `list`. This covers frequency counts, graphs (adjacency `map`), DP
tables (`list` of `list`), and CSV rows without new keywords.

---

## 4. The small core and the standard library

### 4.1 Keywords: 16 → 15 (net change)

Final reserved words:
`let mut fn return if else while for in break continue and or not true false null`

Changes vs today: **add** `null`; **remove nothing that works**. `elif` is *not* added
(`else if` already works **[V]**, `parser.ts` handles `ELSE IF`). No `switch`, `match`,
`class`, `import`, `try`, `lambda`, `do`, `repeat`, `until`, `unless`. Everything those
express is derivable, and each extra keyword is a hallucination surface. `repeat`/`until`
in pseudocode becomes `while true { …; if cond { break; } }` in the model's mapping table
(§7.1).

Operators: `+ - * / // % ** == != < <= > >= and or not`, indexing `[]`, slice `a[i:j]`
**[DECISION]** (replaces the `slice` builtin so the AI uses familiar syntax), ranges
`a..b` (exclusive) and `a..=b` (inclusive) **only inside `for`**, multi-assignment
`a, b = b, a` (needed for swaps and Fibonacci; the LLM already emits it, and it removes the
`temp` variable errors seen in `examples/fibonacci.txt`).

### 4.2 Standard library (fixed, versioned, ~60 functions)

Everything is a **pure function** (returns a new value) unless marked `!` (only mutating form
is index assignment). Grouped so the prompt can present them compactly:

- **core:** `len type str int float bool repr assert(cond, msg) range(a, b, step)`
- **math:** `abs sign min max (variadic or list) sum prod floor ceil round(x, digits)
  trunc sqrt isqrt cbrt exp ln log(x, base) log2 log10 sin cos tan asin acos atan atan2
  hypot pow gcd lcm factorial comb perm divmod modpow modinv is_prime clamp` and constants
  `PI E INF`-as-error (INF is rejected by §3.1, so use `MAX_FLOAT` only)
- **list:** `push(a,x) pop(a) insert(a,i,x) remove_at(a,i) concat sorted(a, key?) sort_by
  reversed slice first last take drop zip enumerate flatten unique count index_of contains
  fill(n, v) map(f, a) filter(f, a) reduce(f, a, init) any all`  → note
  `map/filter/reduce` need function values; see §5.5 decision on first-class functions.
- **stats:** `mean median mode variance stdev(pop|sample) percentile(a,p) quantile cov corr
  cumsum diff histogram(a, bins) argmin argmax rank`
- **matrix (list of lists):** `zeros(r,c) ones identity transpose matmul dot det inv solve`
  — needed by data analysts; `det/inv/solve` return `float` and raise `MathError` on
  singular input.
- **string:** `split join trim upper lower replace starts_with ends_with find char_code
  from_char_code format(fmt, …) parse_int parse_float lines words`
- **map:** `keys values items has get(m,k,default) merge del` (pure) and `m[k] = v` on `mut`.
- **random (seeded only):** `rng(seed)` returns a state value; `rand_int(state,lo,hi)`,
  `rand_float(state)`, `shuffle(state,a)` return `[value, new_state]`. **No global
  `Math.random`**, so results are reproducible (research requirement) and the VM stays
  deterministic.
- **output:** `print(x…)`, `println(x…)`, `table(rows)`, `json(x)`.

Rules for the library that resolve D12/D17: sorting requires **homogeneous** elements or a
`key` function; mixed types raise `TypeError`. Slicing `a[i:j]` clamps out-of-range like
Python and never wraps negatives; **[DECISION]** confirm with owner (alternative: error
on out of range). Empty inputs: `sum([])=0`, `prod([])=1`, `min([])`/`mean([])`/`median([])`
raise `DataError` with hint "empty input" (never NaN).

### 4.3 Single source of truth for builtins (fixes D1, and prevents its return)

Create `src/stdlib/registry.ts`, one array of entries:

```ts
interface Builtin {
  name: string;            // "gcd"
  sig: string;             // "gcd(a:int, b:int) -> int"   (goes into the prompt verbatim)
  doc: string;             // one line, goes into the prompt
  arity: [min: number, max: number];
  pure: boolean;
  impl: (args: Value[], ctx: HostCtx) => Value; // throws typed errors
  example: string;         // used by the doc/test generator
}
```

Everything derives from it: (a) the compiler's call resolution (no `if/else` chain in
`compiler.ts`), (b) VM dispatch by numeric builtin id, (c) the prompt block, (d) the docs,
(e) a **generated test per builtin** running `example` and asserting the documented result.
CI test `registry.drift.test.ts`: the prompt text contains every registry name and nothing
else, and every registry entry has an `impl`. This is the structural fix for D1.

Opcode consequence: the ~14 `OP_ARRAY_*` and the `OP_MATH_CALL` collapse into **one**
`OP_CALL_BUILTIN <id> <argc>` (§5.7). The instruction set stays small while the library grows.

---

## 5. IR (language) and compiler design

### 5.1 Lexer/parser

Rewrite `lexer.ts` / `parser.ts` (keep the structure, they are clean). Requirements:

1. Numbers: `int`, `float`, `1e3`, `2.5e-3`, `1_000`, `0x` hex, `0b` binary. (D13)
2. Identifiers: Unicode letters/digits/`_` via `\p{L}\p{N}`. (D27)
3. Strings: `"…"` and `'…'`, escapes `\n \t \r \\ \" \' \u{…}`; **unterminated string is a
   `LexError` at the opening quote** with hint. (D26)
4. Every lexer failure throws `TextcError` (§5.6), never a bare `Error`. Remove `!` as an
   alias of `not`; `!` alone is an error with hint "use `not`" — but `!=` stays. (D26)
5. Operators per §4.1, including `**`, `//`, `..=`, `:` in slices. (D28)
6. **Semicolons are mandatory statement terminators**; a missing one is
   `ParseError: expected ';'` at the end of the previous token. `;;` (empty statement) is
   allowed. Trailing commas allowed in list/call/param lists. (D29, D30)
7. Comments: `//` and `#` line comments retained; block `/* */` added. Distinguish `//`
   comment vs `//` floor-division: **[DECISION]** comments become `#` and `/* */` only, so
   `//` is unambiguous floor division. Update the prompt: "comments start with `#`".
8. Error recovery: on a parse error, synchronise at the next `;`/`}` and continue, collecting
   up to N diagnostics (D39).
9. `a, b = b, a` parsed as `MultiAssign`. Chained comparison `a<b<c` is **rejected at parse
   time** with hint "use `a<b and b<c`" (D31).

### 5.2 Scoping **[DECISION]**

Lexical block scoping, resolved **at compile time**:

- `let`/`mut` declare in the current block; using a name outside its block is a compile
  error `UndefinedName` (D7). Re-declaring a name in the *same* block is an error
  `Redeclared` (shadowing an outer block's name is allowed).
- The compiler resolves every variable to a **slot index** (locals) or a **global slot**
  (top-level). The VM never looks names up in a `Map` at run time. This removes the
  environment-`Map` allocation per call (performance), makes name-collision bugs (D21)
  structurally impossible, and lets the verifier (§6.2) check every slot access.
- Assigning to a `let` is a **compile-time** `ImmutableAssign` error (today it is a run-time
  `MemorySafetyError` **[V]**); the run-time check stays as defence in depth for hostile
  bytecode.

### 5.3 Short-circuit logic

Compile `a and b` as `a; JUMP_IF_FALSE_KEEP end; POP; b; end:` and `or` symmetrically
(new opcodes `JUMP_IF_FALSE_KEEP` / `JUMP_IF_TRUE_KEEP`, or DUP + `JUMP_IF_*` + POP; pick
the second to avoid new opcodes). Operands must be `bool` (§3.2). Removes `OP_AND`/`OP_OR`
(D9).

### 5.4 Loops

`for` forms (only two):

```
for x in <list|str|map-keys expr> { }      # iterates a SNAPSHOT (D20)
for i in a..b { }   for i in a..=b { }   for i in a..b step s { }
```

- Loop variable is **immutable** in the body (D19); range end and step are evaluated once
  (already true today **[V]**, keep it) and `step == 0` is a compile-time error if literal,
  else `MathError`.
- Descending: `for i in n..0 step -1`. `a..b` with `a>=b` and positive step runs zero times
  (documented), with an optional lint warning (§5.6).
- **Fix D4:** use a forward-patch list. Compile `continue` as `JUMP <placeholder>`, record its
  index in `loopCtx.continueJumps`, and after emitting the body patch all of them to the
  increment block (`for`) or the condition (`while`). Same mechanism already used for
  `breakJumps`. Never read `continueTarget` while compiling the body.
- Hidden loop state (end bound, snapshot, index) lives in **compiler-allocated anonymous
  slots**, not named temps (D21). No user-visible names beginning `__`.
- Add an explicit `loop_limit` guard per §6.3 (the step limit already bounds it).

### 5.5 Functions **[DECISION]**

- Declarations are **hoisted** to the start of their scope, so call-before-declare works
  (D8). Mutual recursion works.
- **Arity is checked at compile time** for direct calls (D22) and at run time for the call
  instruction (defence in depth).
- A function body sees: its parameters, its own locals, top-level **`let`** constants and
  top-level functions. It **cannot read or write top-level `mut`** variables (D25); the
  compiler emits `GlobalMutAccessInFunction` with hint "pass it as a parameter and return the
  new value". This preserves purity/determinism, which is the core value proposition.
- `return` outside a function is a compile error (D24). A function whose last path lacks
  `return` returns `null` (unchanged, **[V]**), but the compiler warns if some paths return
  a value and others fall off the end.
- **First-class functions:** needed for `map/filter/reduce/sorted(key=…)`. **[DECISION]**
  add *only* the anonymous form `fn(x) { return x*2; }` as an expression and allow passing a
  named `fn` by bare name to builtins. **No closures over locals** (captured values are
  copied at creation = by-value capture, consistent with §3.4), so the VM stays a simple
  stack machine with no upvalues. If the owner wants zero function values, remove
  `map/filter/reduce` and keep `sorted(key)` off; the algorithms in `examples/` do not
  need them.
- Recursion depth limit: §6.3.

### 5.6 Diagnostics (AI-native)

One error type used by every phase:

```ts
interface Diagnostic {
  code: string;            // stable, e.g. "E1203 ImmutableAssign"
  phase: "lex"|"parse"|"compile"|"verify"|"run";
  message: string;
  span: { line, col, endLine, endCol };
  hint: string;            // imperative, one line, written for an LLM to act on
  snippet: string;         // the offending line with a caret
}
```

- Machine-readable via `--diagnostics=json` (used by the repair loop, §7.2).
- Human rendering unchanged in spirit (`file:line:col message`).
- Compile phase collects **all** diagnostics before failing (D39).
- Warnings (non-fatal): unused variable, unreachable code, empty-range loop, function with
  inconsistent returns, `mut` never reassigned (suggest `let`).

### 5.7 Instruction set (target ≈ 32 opcodes, from ~50)

```
stack/const:  CONST k | POP | DUP | SWAP
locals:       LOAD_L s | STORE_L s | LOAD_G s | STORE_G s
arith:        ADD SUB MUL DIV IDIV MOD POW NEG
compare:      EQ NE LT LE GT GE
logic:        NOT                       # and/or via jumps
jumps:        JMP t | JMP_F t | JMP_T t
calls:        CALL f argc | CALL_BUILTIN id argc | RET
data:         MK_LIST n | MK_MAP n | INDEX | SET_INDEX | SLICE | LEN(builtin)
iteration:    ITER_INIT | ITER_NEXT t   # snapshot iteration, jumps to t when done
misc:         HALT
```

Rationale: fewer opcodes means a smaller verifier (§6.2), easier fuzzing, less to keep in
the prompt if bytecode is ever shown. All domain behaviour lives in the stdlib registry.

---

## 6. VM, binary format, safety

### 6.1 `.txtc` v2 binary format **[DECISION]**

Replace JSON with a real binary layout:

```
magic "TXTC" | u16 version(=2) | u16 flags | u32 crc32(payload) | u32 payloadLen
sections (each: u8 id, u32 len, bytes):
  0x01 CONSTANTS   tagged values: int(varint zigzag / bigint bytes), float(f64), str(len+utf8), bool, null
  0x02 CODE        per function: u16 arity, u16 nlocals, u32 ninstr, instrs as u8 op + varint operand
  0x03 SOURCEMAP   delta-encoded (line, col) per instruction  -- optional, strippable
  0x04 META        textc version, stdlib version, original source SHA-256
```

Target: the 30-instruction Fibonacci loop from **1550 bytes to well under 300** (target ≈ 8-10 bytes/instruction incl. constants and sourcemap; ≈ 3 bytes/instruction with the sourcemap stripped) **[V baseline]**.
Keep JSON as a debug dump only (`--emit-json`). Version comes from
`TEXTC_BYTECODE_VERSION`, not a literal (D34).

### 6.2 Verifier (runs on every `decode`, before any execution)

Reject with `VerifyError` (not a crash) if any of:
length/CRC mismatch (truncation, D34); unknown opcode; operand out of range (constant
index, local/global slot, builtin id, function index); jump target outside its function or
not on an instruction boundary; `argc` not matching callee arity; **abstract-interpret stack
depth** so every instruction has a known non-negative depth, all paths to a label agree on
depth, and `RET` sees depth ≥ 1 (this rules out stack underflow and the D22 leak);
constants of unknown tag; a slot read before any store on some path (definite assignment).
Also enforces `constants` never used as a name (no name lookup exists any more, so the
`__proto__` case in D34 disappears by construction). Dedup numeric constants with a
type-tagged key using `Object.is`-style comparison so `0`/`-0`/`NaN` cannot merge (D15).

### 6.3 Resource limits (all configurable, all enabled by default)

| Limit | Default | Error |
|---|---|---|
| instruction budget | 50,000,000 (today 5,000,000 **[V]**; raise because true division and BigInt make honest programs longer, but keep finite) | `StepLimit` |
| call depth | 10,000 frames | `StackOverflow` (D23) |
| value stack | 1,000,000 slots | `StackOverflow` |
| heap cap (sum of list/map/str element counts) | 50,000,000 | `MemoryLimit` (blocks `fill(1e9,0)`; not tested today because `1e9` failed to lex, D13) |
| int size | 1,000,000 bits | `MathError` (guards `2**(10**9)`) |
| wall clock | 10 s | `TimeLimit` |
| output size | 10 MB | `OutputLimit` |

CLI flags `--max-steps`, `--max-memory`, `--timeout`. Library callers pass a `Limits` object.

### 6.4 Execution engine

- Flat call-frame array with a preallocated locals region; no `Map` per call.
- `VirtualMachine.run` returns a structured result
  `{ ok, stdout, diagnostics, stats:{steps,maxDepth,heap} }` and **never calls
  `process.exit`** (D37). Only `main.ts` maps the result to an exit code.
- Sourcemap lets `.txtc` runs report `file:line:col` correctly (D35).
- Add `--trace` (per-instruction with op, stack top) and `--stats`; both are for the AI repair
  loop and for learners.

---

## 7. AI layer

### 7.1 Prompt structure (rebuilt from the registry, §4.3)

Generated (not hand-edited) sections, in this order, kept short because the language is small:
1. **Role + contract** (5 lines).
2. **Semantics card** from §3 (the 8 rules that differ from JS/Python: `/` is true division,
   `//` floor, lists are values, conditions are `bool`, no globals inside functions,
   `..` exclusive, no negative index, comments are `#`).
3. **Grammar** (≈25 lines, from a single `grammar.ebnf` shared with the parser tests).
4. **Library block** = the registry `sig` + `doc` lines.
5. **Pseudocode mapping table** (natural language → IR): "repeat … until" → `while true {…
   break}`; "for each" → `for x in`; "while"; "swap" → `a[i], a[j] = a[j], a[i]`; "set X to
   Y"; "increment"; "append"; "the last element"; "if not found return -1", etc. This is
   where "natural language/pseudocode" becomes reliable, so it is the most valuable prompt
   section and must be test-driven (§10).
6. **Error protocol** (existing `TEXTC_ERROR` block, keep; add a `code:` line).
7. **Few-shot examples**, ≥ 8, chosen to cover each mapping row, each validated in CI by
   actually compiling and running them (the current three examples are never executed;
   today one of them uses `sort(arr)` in place, which §3.4 changes).

### 7.2 Generate → verify → repair loop (fixes D36, D39)

```
for attempt in 1..3:
  ir = LLM(prompt, input [, previous_ir, diagnostics_json])
  diags = lex+parse+compile+verify(ir)        # all diagnostics at once
  if no errors: break
  feed diags (code, span, hint, snippet) back as the next user message
```

Then, optionally, **run** the program in a sandbox with a small step budget when the user
asks for `--check`. Settings: `temperature: 0`, fixed `seed` where the provider supports it,
`max_tokens` bounded, and a hard timeout with retry/backoff on 429/5xx (the current
`error.ts` only maps messages, it does not retry **[V]**). Cache `input SHA-256 + prompt
version + model → IR` on disk so re-runs cost zero tokens and are byte-identical.

### 7.3 Ambiguity handling

The model may not silently guess. Add a fourth error type to the protocol alongside
`SyntaxError/DataError/AmbiguityError`: **`AssumptionNote`**. When the input is
underspecified but a reasonable reading exists (e.g. "average" of ints, tie-breaking rule),
the model emits the program **and** `#! assume: mean is true division; ties keep first`
header comments. The CLI prints assumptions to stderr (`--quiet` hides them). Genuine
contradictions still use `AmbiguityError`.

### 7.4 Library-friendliness

`generate()` returns `{ ir, chunk, diagnostics, assumptions }` and throws typed errors; no
`process.exit` outside `main.ts` (D37). Enables tests without spawning a process.

---

## 8. Data handling (researchers and analysts) **[DECISION]**

Solve D38 without new keywords, using builtins and CLI flags:

- `textc prog.txt --data sales.csv` (also `.json`, `.tsv`) binds the file to a reserved
  global constant `DATA` (a `list` of `map` rows, or a `list` of `list` if `--no-header`).
  The model is told the **schema only** (column names, inferred types, row count, first 3
  rows), never the data. The IR references `DATA`, and `.txtc` stores no data so programs are
  reusable across files.
- Output: `table(rows)`, `json(x)`, `--out results.csv`.
- Numeric parsing rules are strict: empty cell → `null` (never `0`), `parse_float` failure →
  `DataError` with row/column in the message.
- Everything stays deterministic: no network, no clock, no filesystem access from inside a
  program except through `--data`/`--out` chosen by the human.

---

## 9. Implementation order (each phase ends green; do not skip the tests-first step)

**Phase 0 — Safety net (1 day).** Port the probe scripts in this repo into
`tests/regression/*.test.ts`, one test per defect ID in §2, **expected to fail on the
current code** (mark `test.failing` or keep in a branch). This is the executable spec.
Also add a Bun-runnable `probe` npm script.

**Phase 1 — Correctness on the existing architecture (2–3 days).** Small, high-value,
low-risk: D2 (`/` true division + `//`), D3, D4 (continue), D9 (short-circuit), D10, D11,
D12, D13 (numeric lexing), D16, D17, D22 (arity), D24, D26–D31, plus the registry (§4.3) that
kills D1. Ship as `0.3.0`. No format change yet.

**Phase 2 — Semantics (3–4 days).** Numbers (§3.1 BigInt/float), value semantics + `let`
immutability (§3.4), block scoping + slot resolution (§5.2), function rules (§5.5), loops
(§5.4), hoisting. New opcode set (§5.7). Ship as `0.4.0` with a migration note (`/` changes
meaning; comments become `#`).

**Phase 3 — Binary v2 + verifier + limits (2–3 days).** §6.1–§6.3. Bump
`TEXTC_BYTECODE_VERSION`; `decode` keeps a clear "v1 unsupported, recompile" error.
Fuzz the verifier (random byte flips of valid `.txtc`; assert only `VerifyError`, never an
uncaught throw or hang).

**Phase 4 — AI loop (2 days).** §7. Prompt generation from the registry, repair loop,
cache, `temperature 0`, structured `generate()` result, remove `process.exit` from library.

**Phase 5 — Stdlib breadth + data (3–4 days).** stats, matrix, string, map, seeded random,
`--data`. Each function ships with its registry `example` (auto-tested).

**Phase 6 — Docs + release.** `docs/SEMANTICS.md`, README claims made true or removed, version
sync check in CI (already present in `release.yml`, keep).

---

## 10. Test strategy (define before coding; keep it lean)

1. **Regression suite** per §2 (one test per ID).
2. **Registry drift test** (§4.3) and **generated per-builtin example tests**.
3. **Golden algorithm suite:** the ten `examples/*.txt`, plus ~30 classic algorithms written
   directly in IR (sorts, gcd, primes/sieve, binary search, DP knapsack/LCS, BFS/DFS on a map
   graph, matrix ops, mean/median/stdev vs. known values). These run without any LLM.
4. **Differential oracle:** for pure numeric programs, generate random programs from a tiny
   grammar and compare against Python `fractions`/`decimal` (run offline in CI) to verify
   §3.1 arithmetic. Restrict to int/`//`/`%`/`**` where Python semantics match §3.3.
5. **Verifier fuzz** (Phase 3) and **limit tests** (deep recursion, `fill` huge, `2**(10**9)`,
   infinite loop, huge output) each asserting a specific limit error and bounded time.
6. **AI evaluation harness (only place a model is called):** a fixed corpus of ≥ 60
   natural-language/pseudocode inputs with expected stdout. Report per-input pass@1 and
   pass@3 (with repair), token cost, and which prompt mapping row each case exercises.
   Store transcripts so regressions are diffable. Gate prompt changes on this number. **No
   AI-quality claim in the README until this exists** (currently zero measured, **[V]** no
   such harness).
7. Keep test count proportional: fast unit tests on every commit; fuzz and the AI harness in
   a nightly job.

---

## 11. Open questions for the owner (block Phase 2, not Phase 1)

1. **Pure builtins vs in-place `sort(arr)`** (§3.4). Recommended: pure. Changes README
   example wording only.
2. **First-class anonymous functions** (§5.5): include `map/filter/reduce`, or stay
   function-value-free?
3. **Slice out-of-range:** clamp (Python-like, recommended) or error? (§4.2)
4. **`decimal` type** for finance (§3.1): defer unless requested.
5. **Comments:** switching to `#`-only to free `//` for floor division (§5.1). Acceptable
   given the AI writes the IR, but existing `.txt` inputs are natural text, so no user
   impact is expected.
6. Target of "compact": prompt tokens, bytecode bytes, or both? (This plan optimises both.)

---

## 12. Risks

- **Strictness vs. AI first-try success.** Hard `bool` conditions and no globals inside
  functions raise first-attempt failures; the repair loop and the mapping table are the
  mitigation, and §10.6 measures it. If pass@1 drops materially, relax §3.2 to *warnings*
  before relaxing anything else.
- **BigInt performance.** Use `number` fast paths for small ints inside the interpreter and
  promote to BigInt on overflow. Benchmark the golden suite before/after.
- **Scope creep in the stdlib.** Admission rule: a function enters only if it is needed by a
  golden-suite algorithm or ≥ 3 real inputs. Removal is a breaking change for `.txtc`
  consumers, so version the stdlib (`META` section).
- **Two behavioural breaks** (`/`, comments). Communicate in the `0.3.0`/`0.4.0` changelog.

---

## Appendix A — Defect → phase map

| Phase 1 | D1 D2 D3 D4 D9 D10 D11 D12 D13 D16 D17 D22 D24 D26 D27 D28 D29 D30 D31 |
|---|---|
| Phase 2 | D5 D6 D7 D8 D14 D15 D18 D19 D20 D21 D25 D32 |
| Phase 3 | D23 D33 D34 D35 |
| Phase 4 | D36 D37 D39 |
| Phase 5 | D38 |

## Appendix B — Probe evidence index

All quoted outputs came from two scripts run with `tsx` against the extracted `src/ir` and
`src/vm` (probe 1: ~85 one-line programs; probe 2: continue/recursion/scoping/decode
checks). Reproduce with the Phase 0 regression tests. One probe first reported "VM math is
empty"; that was a bug in my extraction regex, was caught, re-run correctly, and only
`sin/cos/log` are actually missing (D1). Nothing in this document depends on that first
wrong output.

