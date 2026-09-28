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
    | "IDENTIFIER"
    | "NUMBER"
    | "STRING"
    | "ASSIGN"
    | "PLUS"
    | "MINUS"
    | "STAR"
    | "SLASH"
    | "PERCENT"
    | "EQ"
    | "NEQ"
    | "LT"
    | "LTE"
    | "GT"
    | "GTE"
    | "DOTDOT"
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
};

export class Lexer {
    private source: string;
    private cursor: number = 0;
    private line: number = 1;
    private column: number = 1;

    constructor(source: string) {
        this.source = source;
    }

    private peek(): string {
        return this.source[this.cursor] ?? "";
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
            } else if (char === "/" && this.source[this.cursor + 1] === "/") {
                while (this.cursor < this.source.length && this.peek() !== "\n") {
                    this.advance();
                }
            } else if (char === "#") {
                while (this.cursor < this.source.length && this.peek() !== "\n") {
                    this.advance();
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
        if (char === "*") return { type: "STAR", value: "*", pos: startPos };
        if (char === "/") return { type: "SLASH", value: "/", pos: startPos };
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
                return { type: "DOTDOT", value: "..", pos: startPos };
            }
        }

        if (char === "=") {
            if (this.match("=")) return { type: "EQ", value: "==", pos: startPos };
            return { type: "ASSIGN", value: "=", pos: startPos };
        }

        if (char === "!") {
            if (this.match("=")) return { type: "NEQ", value: "!=", pos: startPos };
            return { type: "NOT", value: "not", pos: startPos };
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
            while (this.cursor < this.source.length && this.peek() !== quote) {
                if (this.peek() === "\\") {
                    this.advance();
                    const escaped = this.advance();
                    if (escaped === "n") strValue += "\n";
                    else if (escaped === "t") strValue += "\t";
                    else strValue += escaped;
                } else {
                    strValue += this.advance();
                }
            }
            if (this.peek() === quote) {
                this.advance();
            }
            return { type: "STRING", value: strValue, pos: startPos };
        }

        // Numbers: integers and floats
        if (/\d/.test(char)) {
            let numStr = char;
            while (/\d/.test(this.peek())) {
                numStr += this.advance();
            }
            if (this.peek() === "." && /\d/.test(this.source[this.cursor + 1] ?? "")) {
                numStr += this.advance(); // '.'
                while (/\d/.test(this.peek())) {
                    numStr += this.advance();
                }
            }
            return { type: "NUMBER", value: numStr, pos: startPos };
        }

        // Identifiers and keywords
        if (/[a-zA-Z_]/.test(char)) {
            let ident = char;
            while (/[a-zA-Z0-9_]/.test(this.peek())) {
                ident += this.advance();
            }
            const keywordType = KEYWORDS[ident];
            if (keywordType) {
                return { type: keywordType, value: ident, pos: startPos };
            }
            return { type: "IDENTIFIER", value: ident, pos: startPos };
        }

        throw new Error(`Unexpected character '${char}' at ${startPos.line}:${startPos.column}`);
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
