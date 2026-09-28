import { Position } from "./ast";

export type TokenType =
    | "LET"
    | "MUT"
    | "FN"
    | "RETURN"
    | "IF"
    | "ELSE"
    | "WHILE"
    | "FOR"
    | "IN"
    | "BREAK"
    | "CONTINUE"
    | "AND"
    | "OR"
    | "NOT"
    | "TRUE"
    | "FALSE"
    | "NULL"
    | "IDENTIFIER"
    | "NUMBER"
    | "STRING"
    | "ASSIGN"
    | "PLUS"
    | "MINUS"
    | "STAR"
    | "STARSTAR"
    | "SLASH"
    | "SLASHSLASH"
    | "PERCENT"
    | "EQ"
    | "NEQ"
    | "LT"
    | "LTE"
    | "GT"
    | "GTE"
    | "DOTDOT"
    | "DOTDOTEQ"
    | "COMMA"
    | "SEMICOLON"
    | "LPAREN"
    | "RPAREN"
    | "LBRACE"
    | "RBRACE"
    | "LBRACKET"
    | "RBRACKET"
    | "EOF";

export interface Token {
    type: TokenType;
    value: string;
    pos: Position;
}

export class LexError extends Error {
    public pos: Position;
    public hint?: string;

    constructor(message: string, pos: Position, hint?: string) {
        super(`${message} at ${pos.line}:${pos.column}`);
        this.name = "LexError";
        this.pos = pos;
        this.hint = hint;
    }
}

const KEYWORDS: Record<string, TokenType> = {
    let: "LET",
    mut: "MUT",
    fn: "FN",
    return: "RETURN",
    if: "IF",
    else: "ELSE",
    while: "WHILE",
    for: "FOR",
    in: "IN",
    break: "BREAK",
    continue: "CONTINUE",
    and: "AND",
    or: "OR",
    not: "NOT",
    true: "TRUE",
    false: "FALSE",
    null: "NULL",
};

export class Lexer {
    private source: string;
    private cursor: number = 0;
    private line: number = 1;
    private column: number = 1;

    constructor(source: string) {
        this.source = source;
    }

    private peek(offset: number = 0): string {
        return this.source[this.cursor + offset] ?? "";
    }

    private advance(): string {
        const char = this.peek();
        this.cursor++;
        if (char === "\n") {
            this.line++;
            this.column = 1;
        } else {
            this.column++;
        }
        return char;
    }

    private match(expected: string): boolean {
        if (this.peek() === expected) {
            this.advance();
            return true;
        }
        return false;
    }

    private skipWhitespaceAndComments(): void {
        while (this.cursor < this.source.length) {
            const char = this.peek();
            if (char === " " || char === "\t" || char === "\r" || char === "\n") {
                this.advance();
            } else if (char === "#") {
                while (this.cursor < this.source.length && this.peek() !== "\n") {
                    this.advance();
                }
            } else if (char === "/" && this.peek(1) === "*") {
                const startPos = { line: this.line, column: this.column };
                this.advance(); // /
                this.advance(); // *
                let closed = false;
                while (this.cursor < this.source.length) {
                    if (this.peek() === "*" && this.peek(1) === "/") {
                        this.advance();
                        this.advance();
                        closed = true;
                        break;
                    }
                    this.advance();
                }
                if (!closed) {
                    throw new LexError("Unterminated block comment", startPos, "Close comment with '*/'");
                }
            } else {
                break;
            }
        }
    }

    public nextToken(): Token {
        this.skipWhitespaceAndComments();

        const startPos: Position = { line: this.line, column: this.column };

        if (this.cursor >= this.source.length) {
            return { type: "EOF", value: "", pos: startPos };
        }

        const char = this.advance();

        // Single & multi-character operators
        if (char === "+") return { type: "PLUS", value: "+", pos: startPos };
        if (char === "-") return { type: "MINUS", value: "-", pos: startPos };
        if (char === "*") {
            if (this.match("*")) return { type: "STARSTAR", value: "**", pos: startPos };
            return { type: "STAR", value: "*", pos: startPos };
        }
        if (char === "/") {
            if (this.match("/")) return { type: "SLASHSLASH", value: "//", pos: startPos };
            return { type: "SLASH", value: "/", pos: startPos };
        }
        if (char === "%") return { type: "PERCENT", value: "%", pos: startPos };
        if (char === ",") return { type: "COMMA", value: ",", pos: startPos };
        if (char === ";") return { type: "SEMICOLON", value: ";", pos: startPos };
        if (char === "(") return { type: "LPAREN", value: "(", pos: startPos };
        if (char === ")") return { type: "RPAREN", value: ")", pos: startPos };
        if (char === "{") return { type: "LBRACE", value: "{", pos: startPos };
        if (char === "}") return { type: "RBRACE", value: "}", pos: startPos };
        if (char === "[") return { type: "LBRACKET", value: "[", pos: startPos };
        if (char === "]") return { type: "RBRACKET", value: "]", pos: startPos };

        if (char === ".") {
            if (this.match(".")) {
                if (this.match("=")) {
                    return { type: "DOTDOTEQ", value: "..=", pos: startPos };
                }
                return { type: "DOTDOT", value: "..", pos: startPos };
            }
            throw new LexError(`Unexpected character '.'`, startPos, "Ranges use '..' or '..='");
        }

        if (char === "=") {
            if (this.match("=")) return { type: "EQ", value: "==", pos: startPos };
            return { type: "ASSIGN", value: "=", pos: startPos };
        }

        if (char === "!") {
            if (this.match("=")) return { type: "NEQ", value: "!=", pos: startPos };
            throw new LexError(`Unexpected '!' operator`, startPos, "Use 'not' for logical negation");
        }

        if (char === "<") {
            if (this.match("=")) return { type: "LTE", value: "<=", pos: startPos };
            return { type: "LT", value: "<", pos: startPos };
        }

        if (char === ">") {
            if (this.match("=")) return { type: "GTE", value: ">=", pos: startPos };
            return { type: "GT", value: ">", pos: startPos };
        }

        if (char === "&" && this.match("&")) {
            return { type: "AND", value: "and", pos: startPos };
        }

        if (char === "|" && this.match("|")) {
            return { type: "OR", value: "or", pos: startPos };
        }

        // Strings: "..." or '...'
        if (char === '"' || char === "'") {
            const quote = char;
            let strValue = "";
            let closed = false;
            while (this.cursor < this.source.length) {
                const nextCh = this.peek();
                if (nextCh === quote) {
                    this.advance();
                    closed = true;
                    break;
                }
                if (nextCh === "\n") {
                    throw new LexError("Unterminated string literal", startPos, `String must be closed with ${quote}`);
                }
                if (nextCh === "\\") {
                    this.advance();
                    const escaped = this.advance();
                    if (escaped === "n") strValue += "\n";
                    else if (escaped === "t") strValue += "\t";
                    else if (escaped === "r") strValue += "\r";
                    else if (escaped === "\\") strValue += "\\";
                    else if (escaped === '"') strValue += '"';
                    else if (escaped === "'") strValue += "'";
                    else strValue += escaped;
                } else {
                    strValue += this.advance();
                }
            }
            if (!closed) {
                throw new LexError("Unterminated string literal", startPos, `String must be closed with ${quote}`);
            }
            return { type: "STRING", value: strValue, pos: startPos };
        }

        // Numbers: integers, floats, hex (0x), binary (0b), scientific notation (1e3), underscores (1_000)
        if (/\d/.test(char)) {
            let numStr = char;
            if (char === "0" && (this.peek() === "x" || this.peek() === "X")) {
                numStr += this.advance(); // 'x'
                while (/[0-9a-fA-F_]/.test(this.peek())) {
                    const c = this.advance();
                    if (c !== "_") numStr += c;
                }
                return { type: "NUMBER", value: numStr, pos: startPos };
            }
            if (char === "0" && (this.peek() === "b" || this.peek() === "B")) {
                numStr += this.advance(); // 'b'
                while (/[01_]/.test(this.peek())) {
                    const c = this.advance();
                    if (c !== "_") numStr += c;
                }
                return { type: "NUMBER", value: numStr, pos: startPos };
            }

            while (/[\d_]/.test(this.peek())) {
                const c = this.advance();
                if (c !== "_") numStr += c;
            }

            // Decimal dot (ensure not part of '..' range)
            if (this.peek() === "." && /\d/.test(this.peek(1))) {
                numStr += this.advance(); // '.'
                while (/[\d_]/.test(this.peek())) {
                    const c = this.advance();
                    if (c !== "_") numStr += c;
                }
            }

            // Scientific exponent: e / E with optional + or -
            if (this.peek() === "e" || this.peek() === "E") {
                let expStr = this.advance();
                if (this.peek() === "+" || this.peek() === "-") {
                    expStr += this.advance();
                }
                if (!/\d/.test(this.peek())) {
                    throw new LexError(`Invalid scientific notation '${numStr + expStr}'`, startPos, "Expected exponent digits");
                }
                while (/[\d_]/.test(this.peek())) {
                    const c = this.advance();
                    if (c !== "_") expStr += c;
                }
                numStr += expStr;
            }

            return { type: "NUMBER", value: numStr, pos: startPos };
        }

        // Identifiers and keywords (including Unicode letters)
        if (/[_\p{L}]/u.test(char)) {
            let ident = char;
            while (/[_\p{L}\p{N}]/u.test(this.peek())) {
                ident += this.advance();
            }
            const keywordType = KEYWORDS[ident];
            if (keywordType) {
                return { type: keywordType, value: ident, pos: startPos };
            }
            return { type: "IDENTIFIER", value: ident, pos: startPos };
        }

        throw new LexError(`Unexpected character '${char}'`, startPos);
    }

    public tokenize(): Token[] {
        const tokens: Token[] = [];
        while (true) {
            const token = this.nextToken();
            tokens.push(token);
            if (token.type === "EOF") break;
        }
        return tokens;
    }
}
