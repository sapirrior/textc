export interface Position {
    line: number;
    column: number;
}

export type ASTNode = Statement | Expression;

export interface BaseNode {
    pos: Position;
}

// ==========================================
// Expressions
// ==========================================

export type Expression =
    | NumberLiteral
    | StringLiteral
    | BooleanLiteral
    | ArrayLiteral
    | Identifier
    | BinaryExpression
    | UnaryExpression
    | CallExpression
    | IndexExpression
    | RangeExpression;

export interface NumberLiteral extends BaseNode {
    type: "NumberLiteral";
    value: number;
}

export interface StringLiteral extends BaseNode {
    type: "StringLiteral";
    value: string;
}

export interface BooleanLiteral extends BaseNode {
    type: "BooleanLiteral";
    value: boolean;
}

export interface ArrayLiteral extends BaseNode {
    type: "ArrayLiteral";
    elements: Expression[];
}

export interface Identifier extends BaseNode {
    type: "Identifier";
    name: string;
}

export type BinaryOperator =
    | "+"
    | "-"
    | "*"
    | "/"
    | "%"
    | "=="
    | "!="
    | "<"
    | "<="
    | ">"
    | ">="
    | "and"
    | "or";

export interface BinaryExpression extends BaseNode {
    type: "BinaryExpression";
    operator: BinaryOperator;
    left: Expression;
    right: Expression;
}

export type UnaryOperator = "-" | "not";

export interface UnaryExpression extends BaseNode {
    type: "UnaryExpression";
    operator: UnaryOperator;
    argument: Expression;
}

export interface CallExpression extends BaseNode {
    type: "CallExpression";
    callee: string;
    arguments: Expression[];
}

export interface IndexExpression extends BaseNode {
    type: "IndexExpression";
    target: Expression;
    index: Expression;
}

export interface RangeExpression extends BaseNode {
    type: "RangeExpression";
    start: Expression;
    end: Expression;
}

// ==========================================
// Statements
// ==========================================

export type Statement =
    | LetStatement
    | MutStatement
    | AssignmentStatement
    | IfStatement
    | WhileStatement
    | ForStatement
    | FunctionDeclaration
    | ReturnStatement
    | BreakStatement
    | ContinueStatement
    | ExpressionStatement;

export interface LetStatement extends BaseNode {
    type: "LetStatement";
    name: string;
    value: Expression;
}

export interface MutStatement extends BaseNode {
    type: "MutStatement";
    name: string;
    value: Expression;
}

export interface AssignmentStatement extends BaseNode {
    type: "AssignmentStatement";
    target: Identifier | IndexExpression;
    value: Expression;
}

export interface IfStatement extends BaseNode {
    type: "IfStatement";
    condition: Expression;
    consequent: Statement[];
    alternate?: Statement[];
}

export interface WhileStatement extends BaseNode {
    type: "WhileStatement";
    condition: Expression;
    body: Statement[];
}

export interface ForStatement extends BaseNode {
    type: "ForStatement";
    variable: string;
    iterable: Expression;
    body: Statement[];
}

export interface FunctionDeclaration extends BaseNode {
    type: "FunctionDeclaration";
    name: string;
    parameters: string[];
    body: Statement[];
}

export interface ReturnStatement extends BaseNode {
    type: "ReturnStatement";
    argument?: Expression;
}

export interface BreakStatement extends BaseNode {
    type: "BreakStatement";
}

export interface ContinueStatement extends BaseNode {
    type: "ContinueStatement";
}

export interface ExpressionStatement extends BaseNode {
    type: "ExpressionStatement";
    expression: Expression;
}

export interface Program extends BaseNode {
    type: "Program";
    body: Statement[];
}
