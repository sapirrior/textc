# ✨ textc (text-compiler)

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/text-compiler.svg?color=cb3837)](https://www.npmjs.com/package/text-compiler)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Engine: Bun & Node](https://img.shields.io/badge/Engine-Bun%20%7C%20Node-black.svg)](https://bun.sh)
[![Language: TypeScript](https://img.shields.io/badge/Language-TypeScript%205.x-blue.svg)](https://www.typescriptlang.org)
[![Memory Safety: Guaranteed](https://img.shields.io/badge/Memory%20Safety-Guaranteed-brightgreen.svg)](#-guaranteed-memory-safety)
[![Target: .txtc Bytecode](https://img.shields.io/badge/Target-.txtc%20Bytecode-purple.svg)](#-the-txtc-bytecode-format)

**The AI-Powered Algorithmic Compiler & Fast Stack Virtual Machine**

*Natural Language In &bull; Deterministic Intermediate Representation &bull; Standalone `.txtc` Binaries &bull; Zero Crashes*

---

</div>

## 🌟 Product Review & Highlights

> **"textc bridges the gap between human algorithmic thought and deterministic binary execution."**

| Metric | Rating | Verdict |
| :--- | :---: | :--- |
| **🧠 AI Transpilation** | ⭐⭐⭐⭐⭐ | Translates fuzzy natural language instructions into strict, deterministic textc IR. |
| **⚡ VM Performance** | ⭐⭐⭐⭐⭐ | Microsecond execution latency using an instruction-optimized stack machine. |
| **🛡️ Memory Safety** | ⭐⭐⭐⭐⭐ | Immutable-by-default (`let` vs `mut`), bounds-checked arrays, and zero-division protection. |
| **📦 Portability** | ⭐⭐⭐⭐⭐ | Generates standalone `.txtc` bytecode binaries running anywhere with zero dependencies. |
| **🎨 Developer Experience** | ⭐⭐⭐⭐⭐ | Clean NPM-style compiler diagnostics with precise source line/column pointers. |

---

## 🏗️ Architecture Pipeline

```mermaid
flowchart LR
    A["🗣️ Natural Language\n/ Pseudocode (.txt)"] --> B["🤖 AI Frontend\n(Prompt Pipeline)"]
    B --> C["📜 textc IR\n(Grammar & AST)"]
    C --> D["⚙️ Bytecode Compiler\n(OpCodes & Chunk)"]
    D --> E["📦 Standalone Binary\n(.txtc File)"]
    E --> F["🚀 textc Virtual Machine\n(Stack Engine)"]
    F --> G["💻 Deterministic Output\n(Console)"]

    style A fill:#4a148c,stroke:#ab47bc,color:#fff
    style B fill:#0d47a1,stroke:#42a5f5,color:#fff
    style C fill:#004d40,stroke:#26a69a,color:#fff
    style D fill:#e65100,stroke:#ffa726,color:#fff
    style E fill:#1b5e20,stroke:#66bb6a,color:#fff
    style F fill:#b71c1c,stroke:#ef5350,color:#fff
    style G fill:#212121,stroke:#9e9e9e,color:#fff
```

---

## 🚀 Quick Start

### 1. Installation via NPM

```bash
# Global installation
npm install -g text-compiler

# Or with bun
bun install -g text-compiler
```

Or clone and build from source:
```bash
git clone https://github.com/sapirrior/textc.git
cd textc
bun install
bun run build
```

### 2. Configure Environment Variables
```bash
export TEXTC_BASE_URL="https://api.openai.com/v1"
export TEXTC_API_KEY="your-api-key-here"
export TEXTC_MODEL_NAME="gpt-4o-mini"
```

### 3. Usage Guide
```bash
# Compile a natural language algorithm into a .txtc bytecode binary:
textc examples/fibonacci.txt
# => textc info compiling fibonacci.txt (target: textc-vm)
# => textc info finished in 480ms
# => textc info emitted bytecode: /path/to/fibonacci.txtc

# Execute the precompiled .txtc binary directly on the VM:
textc fibonacci.txtc
# => textc info running fibonacci.txtc on textc-vm
# => 0, 1, 1, 2, 3, 5, 8, 13, 21, 34

# Compile with custom output path:
textc examples/collatz.txt -o collatz.txtc

# Compile and immediately run in one command:
textc examples/bubble_sort.txt --run

# Emit pure textc Intermediate Representation (IR):
textc examples/fibonacci.txt --emit-ir
```

---

## 💡 Showcase: Natural Language to Bytecode

### 🔹 Example 1: Collatz Conjecture
**Input (`collatz.txt`):**
```text
Start with n = 27. Count the steps until reaching 1.
If even, divide by 2. If odd, multiply by 3 and add 1.
Print each step and the total count.
```

**Generated textc IR:**
```rust
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
println(steps);
```

**Execution Output:**
```text
27
82
41
...
1
111
```

---

### 🔹 Example 2: Array Analytics & Sorting
**Input (`analytics.txt`):**
```text
Numbers: 64, 34, 25, 12, 22, 11, 90
Sort the list in ascending order, reverse it, compute the sum, and print the top 3 items.
```

**Generated textc IR:**
```rust
mut arr = [64, 34, 25, 12, 22, 11, 90];
sort(arr);
reverse(arr);
let total = sum(arr);
let top_three = slice(arr, 0, 3);
println(arr);
println(total);
println(top_three);
```

---

## 🛡️ Guaranteed Memory Safety

textc provides safety guarantees enforced at the compiler and VM levels:

1. **Strict Immutability Invariant:**
   - Variables declared with `let` cannot be reassigned or mutated.
   - Attempting to mutate an immutable binding triggers a `MemorySafetyError` with line and column pointers.
   - Only variables declared with `mut` are allowed to change state.
2. **Bounds-Checked Collections:**
   - Array and string indexing (`arr[i]`) is verified against allocation lengths on every load/store.
3. **Arithmetic Invariant Checking:**
   - Division by zero (`/ 0`) and modulo by zero (`% 0`) are caught and handled safely.

```text
textc error input.txt:3:1 Cannot mutate immutable variable 'x'. Declare it with 'mut' instead of 'let' (MemorySafetyError)
```

---

## 📦 The `.txtc` Bytecode Format

textc compiles to a standalone container format (`.txtc`):

| Offset | Length | Field | Description |
| :--- | :--- | :--- | :--- |
| `0x00` | 4 bytes | `Magic` | ASCII string **`TXTC`** (`0x54 0x58 0x54 0x43`) |
| `0x04` | 2 bytes | `Version` | Bytecode version (`0x0001`) |
| `0x06` | 4 bytes | `Payload Size` | Big-endian payload byte length |
| `0x0A` | Variable | `Payload` | Constant pool, function table, and instruction stream |

---

## 📚 Standard Library Built-ins

| Category | Functions |
| :--- | :--- |
| **Arrays** | `len(arr)`, `push(arr, item)`, `pop(arr)`, `sort(arr)`, `reverse(arr)`, `swap(arr, i, j)`, `slice(arr, start, end)`, `contains(arr, item)`, `index_of(arr, item)`, `fill(count, val)`, `sum(arr)` |
| **Math** | `sqrt(n)`, `pow(base, exp)`, `abs(n)`, `floor(n)`, `ceil(n)`, `round(n)`, `min(a, b)`, `max(a, b)`, `gcd(a, b)`, `lcm(a, b)` |
| **Strings** | `char_at(s, i)`, `split(s, sep)`, `join(arr, sep)`, `to_str(val)`, `to_int(val)` |
| **I/O & Safety** | `print(val)`, `println(val)`, `assert(cond, msg)` |

---

## 📂 Project Structure

```
textc/
├── src/
│   ├── ai/               # AI Frontend & Modular Prompt Engine
│   │   ├── prompts/      # Grammar rules, builtins catalog, error protocol, few-shots
│   │   ├── client.ts     # OpenAI client
│   │   ├── error.ts      # Structured model error parser & NPM formatter
│   │   ├── runner.ts     # Compilation coordinator
│   │   └── index.ts
│   ├── constants/        # Version metadata & magic constants
│   ├── ir/               # AST, Tokenizer/Lexer & Precedence Climbing Parser
│   ├── logger/           # Clean NPM-style compiler diagnostics
│   ├── vm/               # Virtual Machine Runtime, OpCodes, Chunk & Bytecode Compiler
│   │   ├── chunk.ts      # .txtc serialization & deserialization
│   │   ├── compiler.ts   # AST -> Bytecode emitter
│   │   ├── errors.ts     # VM runtime & safety error definitions
│   │   ├── opcodes.ts    # Bytecode instruction set
│   │   ├── types.ts      # Stack values, frames, and variable bindings
│   │   ├── vm.ts         # Stack execution engine
│   │   └── index.ts
│   └── main.ts           # CLI Driver
├── examples/             # Test algorithms
├── dist/                 # Compiled distribution bundle
└── package.json
```

---

## 📜 License

textc is distributed under the [MIT License](LICENSE).
