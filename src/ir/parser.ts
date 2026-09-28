import {
    Statement,
    Expression,
    Program,
    Position,
    BinaryOperator,
    UnaryOperator,
    Identifier,
    IndexExpression,
} from "./ast";
import { Lexer, Token, TokenType } from "./lexer";

export class ParseError extends Error {
    public pos: Position;

    constructor(message: string, pos: Position) {
        super(`${message} at ${pos.line}:${pos.column}`);
        this.name = "ParseError";
        this.pos = pos;
    }
}

export class Parser {
    private tokens: Token[];
    private current: number = 0;

    constructor(sourceOrTokens: string | Token[]) {
        if (typeof sourceOrTokens === "string") {
            const lexer = new Lexer(sourceOrTokens);
            this.tokens = lexer.tokenize();
        } else {
            this.tokens = sourceOrTokens;
        }
    }

    private peek(): Token {
        return this.tokens[this.current] ?? { type: "EOF", value: "", pos: { line: 1, column: 1 } };
    }

    private previous(): Token {
        return this.tokens[this.current - 1] ?? this.peek();
    }

    private isAtEnd(): boolean {
        return this.peek().type === "EOF";
    }

    private check(type: TokenType): boolean {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    private advance(): Token {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    private match(...types: TokenType[]): boolean {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    private consume(type: TokenType, message: string): Token {
        if (this.check(type)) return this.advance();
        const currentToken = this.peek();
        throw new ParseError(message, currentToken.pos);
    }

    private matchSemicolon(): void {
        this.match("SEMICOLON");
    }

    public parse(): Program {
        const startPos = this.peek().pos;
        const statements: Statement[] = [];

        while (!this.isAtEnd()) {
            statements.push(this.statement());
        }

        return {
            type: "Program",
            body: statements,
            pos: startPos,
        };
    }

    private statement(): Statement {
        if (this.match("LET")) return this.letStatement();
        if (this.match("MUT")) return this.mutStatement();
        if (this.match("FN")) return this.functionDeclaration();
        if (this.match("IF")) return this.ifStatement();
        if (this.match("WHILE")) return this.whileStatement();
        if (this.match("FOR")) return this.forStatement();
        if (this.match("RETURN")) return this.returnStatement();
        if (this.match("BREAK")) return this.breakStatement();
        if (this.match("CONTINUE")) return this.continueStatement();

        return this.expressionOrAssignmentStatement();
    }

    private letStatement(): Statement {
        const pos = this.previous().pos;
        const nameToken = this.consume("IDENTIFIER", "Expected variable name after 'let'");
        this.consume("ASSIGN", "Expected '=' in variable declaration");
        const value = this.expression();
        this.matchSemicolon();

        return {
            type: "LetStatement",
            name: nameToken.value,
            value,
            pos,
        };
    }

    private mutStatement(): Statement {
        const pos = this.previous().pos;
        const nameToken = this.consume("IDENTIFIER", "Expected variable name after 'mut'");
        this.consume("ASSIGN", "Expected '=' in mutable variable declaration");
        const value = this.expression();
        this.matchSemicolon();

        return {
            type: "MutStatement",
            name: nameToken.value,
            value,
            pos,
        };
    }

    private functionDeclaration(): Statement {
        const pos = this.previous().pos;
        const nameToken = this.consume("IDENTIFIER", "Expected function name after 'fn'");
        this.consume("LPAREN", "Expected '(' after function name");

        const parameters: string[] = [];
        if (!this.check("RPAREN")) {
            do {
                if (this.match("MUT")) {
                    // allow optional mut keyword in parameter list
                }
                const paramToken = this.consume("IDENTIFIER", "Expected parameter name");
                parameters.push(paramToken.value);
            } while (this.match("COMMA"));
        }
        this.consume("RPAREN", "Expected ')' after parameters");
        this.consume("LBRACE", "Expected '{' before function body");

        const body: Statement[] = [];
        while (!this.check("RBRACE") && !this.isAtEnd()) {
            body.push(this.statement());
        }
        this.consume("RBRACE", "Expected '}' after function body");

        return {
            type: "FunctionDeclaration",
            name: nameToken.value,
            parameters,
            body,
            pos,
        };
    }

    private ifStatement(): Statement {
        const pos = this.previous().pos;
        const condition = this.expression();
        this.consume("LBRACE", "Expected '{' after if condition");

        const consequent: Statement[] = [];
        while (!this.check("RBRACE") && !this.isAtEnd()) {
            consequent.push(this.statement());
        }
        this.consume("RBRACE", "Expected '}' after if block");

        let alternate: Statement[] | undefined;
        if (this.match("ELSE")) {
            if (this.match("IF")) {
                alternate = [this.ifStatement()];
            } else {
                this.consume("LBRACE", "Expected '{' after 'else'");
                alternate = [];
                while (!this.check("RBRACE") && !this.isAtEnd()) {
                    alternate.push(this.statement());
                }
                this.consume("RBRACE", "Expected '}' after else block");
            }
        }

        return {
            type: "IfStatement",
            condition,
            consequent,
            alternate,
            pos,
        };
    }

    private whileStatement(): Statement {
        const pos = this.previous().pos;
        const condition = this.expression();
        this.consume("LBRACE", "Expected '{' after while condition");

        const body: Statement[] = [];
        while (!this.check("RBRACE") && !this.isAtEnd()) {
            body.push(this.statement());
        }
        this.consume("RBRACE", "Expected '}' after while block");

        return {
            type: "WhileStatement",
            condition,
            body,
            pos,
        };
    }

    private forStatement(): Statement {
        const pos = this.previous().pos;
        const varToken = this.consume("IDENTIFIER", "Expected loop variable name after 'for'");
        this.consume("IN", "Expected 'in' after for loop variable");
        const iterable = this.expression();
        this.consume("LBRACE", "Expected '{' after for loop iterable");

        const body: Statement[] = [];
        while (!this.check("RBRACE") && !this.isAtEnd()) {
            body.push(this.statement());
        }
        this.consume("RBRACE", "Expected '}' after for block");

        return {
            type: "ForStatement",
            variable: varToken.value,
            iterable,
            body,
            pos,
        };
    }

    private returnStatement(): Statement {
        const pos = this.previous().pos;
        let argument: Expression | undefined;
        if (!this.check("SEMICOLON") && !this.check("RBRACE")) {
            argument = this.expression();
        }
        this.matchSemicolon();

        return {
            type: "ReturnStatement",
            argument,
            pos,
        };
    }

    private breakStatement(): Statement {
        const pos = this.previous().pos;
        this.matchSemicolon();
        return { type: "BreakStatement", pos };
    }

    private continueStatement(): Statement {
        const pos = this.previous().pos;
        this.matchSemicolon();
        return { type: "ContinueStatement", pos };
    }

    private expressionOrAssignmentStatement(): Statement {
        const pos = this.peek().pos;
        const expr = this.expression();

        if (this.match("ASSIGN")) {
            if (expr.type === "Identifier" || expr.type === "IndexExpression") {
                const value = this.expression();
                this.matchSemicolon();
                return {
                    type: "AssignmentStatement",
                    target: expr as Identifier | IndexExpression,
                    value,
                    pos,
                };
            }
            throw new ParseError("Invalid assignment target", pos);
        }

        this.matchSemicolon();
        return {
            type: "ExpressionStatement",
            expression: expr,
            pos,
        };
    }

    // ==========================================
    // Expression Parsing (Precedence Climbing)
    // ==========================================

    private expression(): Expression {
        return this.range();
    }

    private range(): Expression {
        const left = this.logicalOr();
        if (this.match("DOTDOT")) {
            const pos = this.previous().pos;
            const right = this.logicalOr();
            return {
                type: "RangeExpression",
                start: left,
                end: right,
                pos,
            };
        }
        return left;
    }

    private logicalOr(): Expression {
        let left = this.logicalAnd();
        while (this.match("OR")) {
            const pos = this.previous().pos;
            const right = this.logicalAnd();
            left = {
                type: "BinaryExpression",
                operator: "or",
                left,
                right,
                pos,
            };
        }
        return left;
    }

    private logicalAnd(): Expression {
        let left = this.equality();
        while (this.match("AND")) {
            const pos = this.previous().pos;
            const right = this.equality();
            left = {
                type: "BinaryExpression",
                operator: "and",
                left,
                right,
                pos,
            };
        }
        return left;
    }

    private equality(): Expression {
        let left = this.comparison();
        while (this.match("EQ", "NEQ")) {
            const opToken = this.previous();
            const operator = opToken.value as BinaryOperator;
            const right = this.comparison();
            left = {
                type: "BinaryExpression",
                operator,
                left,
                right,
                pos: opToken.pos,
            };
        }
        return left;
    }

    private comparison(): Expression {
        let left = this.term();
        while (this.match("LT", "LTE", "GT", "GTE")) {
            const opToken = this.previous();
            const operator = opToken.value as BinaryOperator;
            const right = this.term();
            left = {
                type: "BinaryExpression",
                operator,
                left,
                right,
                pos: opToken.pos,
            };
        }
        return left;
    }

    private term(): Expression {
        let left = this.factor();
        while (this.match("PLUS", "MINUS")) {
            const opToken = this.previous();
            const operator = opToken.value as BinaryOperator;
            const right = this.factor();
            left = {
                type: "BinaryExpression",
                operator,
                left,
                right,
                pos: opToken.pos,
            };
        }
        return left;
    }

    private factor(): Expression {
        let left = this.unary();
        while (this.match("STAR", "SLASH", "PERCENT")) {
            const opToken = this.previous();
            const operator = opToken.value as BinaryOperator;
            const right = this.unary();
            left = {
                type: "BinaryExpression",
                operator,
                left,
                right,
                pos: opToken.pos,
            };
        }
        return left;
    }

    private unary(): Expression {
        if (this.match("MINUS", "NOT")) {
            const opToken = this.previous();
            const operator = (opToken.type === "MINUS" ? "-" : "not") as UnaryOperator;
            const argument = this.unary();
            return {
                type: "UnaryExpression",
                operator,
                argument,
                pos: opToken.pos,
            };
        }
        return this.callOrIndex();
    }

    private callOrIndex(): Expression {
        let expr = this.primary();

        while (true) {
            if (this.match("LPAREN")) {
                if (expr.type !== "Identifier") {
                    throw new ParseError("Can only call named functions", expr.pos);
                }
                const args: Expression[] = [];
                if (!this.check("RPAREN")) {
                    do {
                        args.push(this.expression());
                    } while (this.match("COMMA"));
                }
                this.consume("RPAREN", "Expected ')' after arguments");
                expr = {
                    type: "CallExpression",
                    callee: expr.name,
                    arguments: args,
                    pos: expr.pos,
                };
            } else if (this.match("LBRACKET")) {
                const index = this.expression();
                this.consume("RBRACKET", "Expected ']' after index");
                expr = {
                    type: "IndexExpression",
                    target: expr,
                    index,
                    pos: expr.pos,
                };
            } else {
                break;
            }
        }

        return expr;
    }

    private primary(): Expression {
        const token = this.peek();

        if (this.match("NUMBER")) {
            return {
                type: "NumberLiteral",
                value: parseFloat(token.value),
                pos: token.pos,
            };
        }

        if (this.match("STRING")) {
            return {
                type: "StringLiteral",
                value: token.value,
                pos: token.pos,
            };
        }

        if (this.match("TRUE")) {
            return {
                type: "BooleanLiteral",
                value: true,
                pos: token.pos,
            };
        }

        if (this.match("FALSE")) {
            return {
                type: "BooleanLiteral",
                value: false,
                pos: token.pos,
            };
        }

        if (this.match("IDENTIFIER")) {
            return {
                type: "Identifier",
                name: token.value,
                pos: token.pos,
            };
        }

        if (this.match("LBRACKET")) {
            const elements: Expression[] = [];
            if (!this.check("RBRACKET")) {
                do {
                    elements.push(this.expression());
                } while (this.match("COMMA"));
            }
            this.consume("RBRACKET", "Expected ']' after array elements");
            return {
                type: "ArrayLiteral",
                elements,
                pos: token.pos,
            };
        }

        if (this.match("LPAREN")) {
            const expr = this.expression();
            this.consume("RPAREN", "Expected ')' after expression");
            return expr;
        }

        throw new ParseError(`Unexpected token '${token.value || token.type}'`, token.pos);
    }
}
