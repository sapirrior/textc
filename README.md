# ✨ textc (text-compiler)

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/text-compiler.svg?color=cb3837&style=for-the-badge)](https://www.npmjs.com/package/text-compiler)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Memory Safety: Guaranteed](https://img.shields.io/badge/Memory%20Safety-Guaranteed-brightgreen.svg?style=for-the-badge)](#-the-magic-why-textc-is-insanely-cool)
[![Target: .txtc Bytecode](https://img.shields.io/badge/Target-.txtc%20Bytecode-purple.svg?style=for-the-badge)](#-the-magic-why-textc-is-insanely-cool)

### **Stop wasting API tokens on math. Stop trusting LLMs to do loops.**
**Write natural language once &bull; Compile to `.txtc` bytecode &bull; Run forever at 0ms latency with zero tokens.**

```bash
npm install -g text-compiler
```

---

</div>

## 😱 The Pain: What Happens If You Don't Use textc?

If you ask a normal AI model to run algorithms or calculate math directly inside a prompt, you run into **four huge nightmares**:

```
❌ The LLM Hallucination Trap:
   Ask an LLM to calculate "143 * 87" or run a 100-step loop.
   It guesses token probabilities instead of doing real arithmetic.
   Result: Random, subtle, silent calculation errors.

❌ The Token Drain & Burning Wallet:
   Every time your user runs a calculation, you send another expensive API request.
   Running an algorithm 1,000 times = 1,000 paid API calls and 1,000 awkward 3-second loading spinners.

❌ The Non-Deterministic Roulette:
   The same prompt run 5 times gives 3 different answers.
   You cannot ship reliable software on top of vibes and probabilistic arithmetic.

❌ Crash-Prone Spaghetti Code:
   Asking an LLM to write raw Python or JS often produces unbounded arrays,
   unhandled division-by-zero, and state mutation chaos that crashes in production.
```

---

## ⚡ The Solution: Why textc Is Insanely Cool

`textc` completely reimagines how humans and AI write software. You describe an algorithm in plain English, and `textc` turns it into a **standalone, deterministic bytecode binary (`.txtc`)**.

```mermaid
flowchart LR
    A["🗣️ You Write Natural English\n('Sort list and find top 3')"] --> B["🤖 textc Transpiles Once\n(Generates Strict IR)"]
    B --> C["📦 Compiles to .txtc\n(Standalone Bytecode)"]
    C --> D["⚡ Executes in Microseconds\n(Zero Tokens, 100% Deterministic)"]

    style A fill:#7b1fa2,stroke:#ba68c8,color:#fff
    style B fill:#1565c0,stroke:#64b5f6,color:#fff
    style C fill:#2e7d32,stroke:#81c784,color:#fff
    style D fill:#d84315,stroke:#ff8a65,color:#fff
```

### 🎯 What makes textc feel like magic:

1. **💸 Compile Once, Run Forever for Free**
   Transpile your natural language prompt with AI once into a `.txtc` binary. From then on, execute the `.txtc` file directly on the `textc` virtual machine in **0.1 milliseconds** with **zero API calls and zero cost**.

2. **🔒 Guaranteed Memory Safety & Zero Crashes**
   `textc` enforces strict immutability invariants (`let` vs `mut`), bounds-checked arrays, and zero-division protection. It is physically impossible for compiled code to corrupt memory or crash unexpectedly.

3. **🎯 100% Deterministic Math & Loops**
   No more token hallucinations. Math is computed by a real deterministic stack virtual machine. `2 + 2` is always `4`, whether you run it once or a billion times.

4. **🚀 Instant Standalone Binaries**
   Share your `.txtc` bytecode files across servers, CLI tools, edge devices, or cloud functions.

---

## 🥊 The Showdown: Old Way vs. textc

| Feature | The Old Way (Prompting Raw LLMs) | The textc Way |
| :--- | :--- | :--- |
| **Arithmetic Reliability** | 🎲 Guesses tokens (often wrong on large numbers) | 🎯 **100% Mathematical Precision** |
| **Execution Cost** | 💸 Pay API fees on every single execution | 🆓 **Compile once, run infinitely for $0** |
| **Speed / Latency** | ⏳ 2,000ms – 5,000ms per prompt | ⚡ **< 1ms execution on the VM** |
| **Memory Safety** | ❌ None (random exceptions, undefined variables) | 🛡️ **Compile-time mutability & bounds safety** |
| **Portability** | 🔒 Locked behind internet connection & API keys | 📦 **Standalone `.txtc` binary running offline** |

---

## 🚀 Get Started in 30 Seconds

### 1. Install
```bash
npm install -g text-compiler
```

### 2. Set Your API Key (Only used once during compilation!)
```bash
export TEXTC_BASE_URL="https://api.openai.com/v1"
export TEXTC_API_KEY="your-api-key"
export TEXTC_MODEL_NAME="gpt-4o-mini"
```

### 3. Write Plain English (`fib.txt`)
```text
Generate the first 10 Fibonacci numbers starting with 0 and 1.
Print each number as you go.
```

### 4. Compile to `.txtc` Bytecode
```bash
textc fib.txt
```
```
textc info compiling fib.txt (target: textc-vm)
textc info finished in 350ms
textc info emitted bytecode: /workspace/fib.txtc
```

### 5. Run the Bytecode at Lightning Speed (No API needed!)
```bash
textc fib.txtc
```
```
textc info running fib.txtc on textc-vm
textc info finished in 0ms
0
1
1
2
3
5
8
13
21
34
```

---

## 💡 Real-World Examples

### 🔹 Array Sorting & Data Analytics
**`analytics.txt`:**
```text
List of numbers: 64, 34, 25, 12, 22, 11, 90
Sort them in ascending order, reverse the order, compute the sum, and print the top 3 highest values.
```
```bash
textc analytics.txt --run
```
```
[90, 64, 34, 25, 22, 12, 11]
258
[90, 64, 34]
```

---

### 🔹 Collatz Conjecture Step Explorer
**`collatz.txt`:**
```text
Start at n = 27. If n is even, divide by 2. If odd, multiply by 3 and add 1.
Keep going until n reaches 1. Print the number of steps and the highest number reached.
```
```bash
textc collatz.txt --run
```

---

## 🛠️ CLI Cheat Sheet

```bash
# Compile natural language to .txtc bytecode:
textc algorithm.txt

# Specify a custom output file:
textc algorithm.txt -o my_binary.txtc

# Run precompiled bytecode directly on the VM:
textc my_binary.txtc

# Compile and immediately run in one shot:
textc algorithm.txt --run

# Inspect the intermediate representation (IR):
textc algorithm.txt --emit-ir
```

---

## 🛡️ Built-in Memory Protection In Action

Try to mutate an immutable variable or access an array out of bounds? `textc` stops it cold:

```text
textc error algo.txt:3:1 Cannot mutate immutable variable 'total'. Declare it with 'mut' instead of 'let' (MemorySafetyError)
```

---

## 📜 License

Distributed under the [MIT License](LICENSE). Built for the future of algorithmic coding.
