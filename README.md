# ✨ textc (text-compiler)

<div align="center">

[![NPM Version](https://img.shields.io/npm/v/text-compiler.svg?color=cb3837&style=for-the-badge)](https://www.npmjs.com/package/text-compiler)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Runs on: Any Natural Language](https://img.shields.io/badge/Language-Any%20Natural%20Text-brightgreen.svg?style=for-the-badge)](#-write-algorithms-in-any-natural-text)

### **Turn Any Natural Language into Fast, Executable Algorithms.**
**Speak your logic in plain English &bull; Compile into standalone `.txtc` programs &bull; Run anywhere.**

```bash
npm install -g text-compiler
```

---

</div>

## 💡 What is textc?

**`textc` is the world's simplest algorithm compiler.**

You don't need to learn complicated programming languages, struggle with missing semicolons, or memorize syntax rules. Just write your algorithm the way you think — in plain English, bullet points, numbered steps, or even a story — and `textc` compiles it into an instant executable program.

```mermaid
flowchart LR
    A["✍️ You Write Plain Text\n('Take scores, drop lowest, find average')"] --> B["⚡ textc Compiles It\n(Understands your logic)"]
    B --> C["🚀 Instant Executable\n(.txtc Program)"]
    C --> D["🎯 Exact Results\n(Runs in 0ms)"]

    style A fill:#7b1fa2,stroke:#ba68c8,color:#fff
    style B fill:#1565c0,stroke:#64b5f6,color:#fff
    style C fill:#2e7d32,stroke:#81c784,color:#fff
    style D fill:#d84315,stroke:#ff8a65,color:#fff
```

---

## 🌈 Write Algorithms in ANY Natural Text

`textc` understands whatever format feels most natural to you:

### 1️⃣ Conversational Notes & Requests
**`scores.txt`:**
```text
I have test scores: [88, 92, 79, 95, 61, 84].
Sort them, remove the single lowest score, and calculate the average of the remaining ones.
Print the final average.
```
```bash
textc scores.txt --run
```
```
84
```

---

### 2️⃣ Step-by-Step Instructions
**`investment.txt`:**
```text
1. Start with 1000 dollars.
2. For 5 years in a row:
   - Grow the balance by 8% each year.
   - Add a 200 dollar bonus at the end of each year.
3. Print the final balance.
```
```bash
textc investment.txt --run
```
```
2637
```

---

### 3️⃣ Math Puzzles & Number Riddles
**`collatz.txt`:**
```text
Start with the number 27.
If it is even, cut it in half.
If it is odd, multiply by 3 and add 1.
Repeat until you reach 1, and count how many steps it took.
Print the total step count.
```
```bash
textc collatz.txt --run
```
```
111
```

---

### 4️⃣ Data Filtering & Finding Extremes
**`inventory.txt`:**
```text
Prices: [45, 12, 89, 23, 67, 105, 34]
Find the cheapest item and the most expensive item.
Print the difference between the most expensive and cheapest items.
```
```bash
textc inventory.txt --run
```
```
93
```

---

### 5️⃣ Text & Palindrome Fun
**`words.txt`:**
```text
Given word letters: ["r", "a", "c", "e", "c", "a", "r"]
Reverse the letters and check if it spells the same word forwards and backwards.
Print true if it's a palindrome, false otherwise.
```
```bash
textc words.txt --run
```
```
true
```

---

## ⚡ Why You'll Love textc

- 🗣️ **Zero Coding Required:** Describe your idea in everyday language.
- ⚡ **Lightning Fast:** Once compiled, your `.txtc` program runs in less than 1 millisecond.
- 📦 **Save & Share:** Produces standalone `.txtc` program files that you can run anytime, anywhere, completely offline.
- 🛡️ **Zero Crashes:** Automatic bounds checking, safe math, and memory protection built in.

---

## 🚀 Get Started in 3 Steps

### Step 1: Install
```bash
npm install -g text-compiler
```

### Step 2: Set Your AI Key (For compilation)
```bash
export TEXTC_BASE_URL="https://api.openai.com/v1"
export TEXTC_API_KEY="your-api-key"
export TEXTC_MODEL_NAME="gpt-4o-mini"
```

### Step 3: Write & Run!
```bash
# Write any text file
echo "Find the sum of all numbers from 1 to 100" > sum.txt

# Run it directly!
textc sum.txt --run
```
```
5050
```

---

## 🛠️ Handy Commands

```bash
# Compile and run your plain-text file in one go:
textc my_notes.txt --run

# Compile your natural text into a shareable .txtc program file:
textc my_notes.txt

# Run a saved .txtc program instantly:
textc my_notes.txtc
```

---

## 📜 License

Distributed under the [MIT License](LICENSE). Turn your thoughts into running software.
