import { describe, expect, test } from "bun:test";
import { Lexer, Parser, ParseError } from "../src/ir";

describe("IR Lexer & Parser", () => {
    test("tokenizes and parses variable declarations with mutability", () => {
        const source = `
        let a = 100;
        mut b = 200;
        `;
        const parser = new Parser(source);
        const ast = parser.parse();

        expect(ast.body.length).toBe(2);
        expect(ast.body[0]?.type).toBe("LetStatement");
        expect((ast.body[0] as any).name).toBe("a");
        expect((ast.body[0] as any).value.value).toBe(100);

        expect(ast.body[1]?.type).toBe("MutStatement");
        expect((ast.body[1] as any).name).toBe("b");
        expect((ast.body[1] as any).value.value).toBe(200);
    });

    test("parses binary expressions respecting operator precedence", () => {
        const source = `let res = 2 + 3 * 4;`;
        const parser = new Parser(source);
        const ast = parser.parse();

        const letStmt = ast.body[0] as any;
        expect(letStmt.value.type).toBe("BinaryExpression");
        expect(letStmt.value.operator).toBe("+");
        expect(letStmt.value.left.value).toBe(2);
        expect(letStmt.value.right.type).toBe("BinaryExpression");
        expect(letStmt.value.right.operator).toBe("*");
    });

    test("parses while loops, if-else, and break/continue", () => {
        const source = `
        mut i = 0;
        while i < 10 {
            if i == 5 {
                break;
            } else {
                i = i + 1;
                continue;
            }
        }
        `;
        const parser = new Parser(source);
        const ast = parser.parse();

        expect(ast.body.length).toBe(2);
        const whileStmt = ast.body[1] as any;
        expect(whileStmt.type).toBe("WhileStatement");
        expect(whileStmt.body.length).toBe(1);
        expect(whileStmt.body[0].type).toBe("IfStatement");
        expect(whileStmt.body[0].consequent[0].type).toBe("BreakStatement");
        expect(whileStmt.body[0].alternate[1].type).toBe("ContinueStatement");
    });

    test("parses range expressions and for-loops", () => {
        const source = `
        for x in 0..10 {
            print(x);
        }
        `;
        const parser = new Parser(source);
        const ast = parser.parse();

        expect(ast.body.length).toBe(1);
        const forStmt = ast.body[0] as any;
        expect(forStmt.type).toBe("ForStatement");
        expect(forStmt.variable).toBe("x");
        expect(forStmt.iterable.type).toBe("RangeExpression");
        expect(forStmt.iterable.start.value).toBe(0);
        expect(forStmt.iterable.end.value).toBe(10);
    });

    test("parses function declarations with parameters", () => {
        const source = `
        fn add(x, y) {
            return x + y;
        }
        `;
        const parser = new Parser(source);
        const ast = parser.parse();

        expect(ast.body.length).toBe(1);
        const fnDecl = ast.body[0] as any;
        expect(fnDecl.type).toBe("FunctionDeclaration");
        expect(fnDecl.name).toBe("add");
        expect(fnDecl.parameters).toEqual(["x", "y"]);
        expect(fnDecl.body[0].type).toBe("ReturnStatement");
    });

    test("throws ParseError with line/col on syntax errors", () => {
        const source = `let = 10;`;
        const parser = new Parser(source);
        expect(() => parser.parse()).toThrow(ParseError);
    });
});
