import {
    Program,
    Statement,
    Expression,
    Position,
} from "../ir/ast";
import { Chunk } from "./chunk";
import { OpCode } from "./opcodes";
import { BytecodeCompilationError } from "./errors";
import { BUILTINS_MAP } from "../stdlib/registry";

interface LoopContext {
    continueTarget?: number;
    continueJumps: number[];
    breakJumps: number[];
}

export class BytecodeCompiler {
    private chunk: Chunk = new Chunk();
    private loopStack: LoopContext[] = [];
    private functionDepth: number = 0;
    private declaredFunctions: Map<string, number> = new Map();

    public compile(program: Program): Chunk {
        this.chunk = new Chunk();
        this.loopStack = [];
        this.functionDepth = 0;
        this.declaredFunctions.clear();

        // Hoist / pre-record function declarations
        for (const stmt of program.body) {
            if (stmt.type === "FunctionDeclaration") {
                this.declaredFunctions.set(stmt.name, stmt.parameters.length);
            }
        }

        for (const stmt of program.body) {
            this.compileStatement(stmt);
        }

        this.chunk.emit(OpCode.OP_HALT, undefined, program.pos);
        return this.chunk;
    }

    private compileStatement(stmt: Statement): void {
        switch (stmt.type) {
            case "EmptyStatement":
                break;

            case "LetStatement": {
                this.compileExpression(stmt.value);
                const nameIdx = this.chunk.addConstant(stmt.name);
                this.chunk.emit(OpCode.OP_DEFINE_LET, nameIdx, stmt.pos);
                break;
            }

            case "MutStatement": {
                this.compileExpression(stmt.value);
                const nameIdx = this.chunk.addConstant(stmt.name);
                this.chunk.emit(OpCode.OP_DEFINE_MUT, nameIdx, stmt.pos);
                break;
            }

            case "AssignmentStatement": {
                if (stmt.target.type === "Identifier") {
                    this.compileExpression(stmt.value);
                    const nameIdx = this.chunk.addConstant(stmt.target.name);
                    this.chunk.emit(OpCode.OP_SET_VAR, nameIdx, stmt.pos);
                } else if (stmt.target.type === "IndexExpression") {
                    this.compileExpression(stmt.target.target);
                    this.compileExpression(stmt.target.index);
                    this.compileExpression(stmt.value);
                    this.chunk.emit(OpCode.OP_SET_INDEX, undefined, stmt.pos);
                } else {
                    throw new BytecodeCompilationError("Invalid assignment target", stmt.pos);
                }
                break;
            }

            case "IfStatement": {
                this.compileExpression(stmt.condition);
                const jumpFalseIdx = this.chunk.emit(OpCode.OP_JUMP_IF_FALSE, 0, stmt.pos);

                for (const s of stmt.consequent) {
                    this.compileStatement(s);
                }

                if (stmt.alternate && stmt.alternate.length > 0) {
                    const jumpEndIdx = this.chunk.emit(OpCode.OP_JUMP, 0, stmt.pos);
                    const altStart = this.chunk.instructions.length;
                    this.chunk.patchJump(jumpFalseIdx, altStart);

                    for (const s of stmt.alternate) {
                        this.compileStatement(s);
                    }
                    const endIdx = this.chunk.instructions.length;
                    this.chunk.patchJump(jumpEndIdx, endIdx);
                } else {
                    const endIdx = this.chunk.instructions.length;
                    this.chunk.patchJump(jumpFalseIdx, endIdx);
                }
                break;
            }

            case "WhileStatement": {
                const loopStart = this.chunk.instructions.length;
                const loopCtx: LoopContext = {
                    continueTarget: loopStart,
                    continueJumps: [],
                    breakJumps: [],
                };
                this.loopStack.push(loopCtx);

                this.compileExpression(stmt.condition);
                const exitJump = this.chunk.emit(OpCode.OP_JUMP_IF_FALSE, 0, stmt.pos);

                for (const s of stmt.body) {
                    this.compileStatement(s);
                }

                this.chunk.emit(OpCode.OP_LOOP, loopStart, stmt.pos);
                const loopEnd = this.chunk.instructions.length;
                this.chunk.patchJump(exitJump, loopEnd);

                for (const continueJump of loopCtx.continueJumps) {
                    this.chunk.patchJump(continueJump, loopStart);
                }

                for (const breakJump of loopCtx.breakJumps) {
                    this.chunk.patchJump(breakJump, loopEnd);
                }

                this.loopStack.pop();
                break;
            }

            case "ForStatement": {
                if (stmt.iterable.type === "RangeExpression") {
                    // let variable = start
                    this.compileExpression(stmt.iterable.start);
                    const varIdx = this.chunk.addConstant(stmt.variable);
                    this.chunk.emit(OpCode.OP_DEFINE_MUT, varIdx, stmt.pos);

                    // end bound temp
                    this.compileExpression(stmt.iterable.end);
                    const endVarName = `__end_${stmt.variable}_${stmt.pos.line}_${stmt.pos.column}`;
                    const endVarIdx = this.chunk.addConstant(endVarName);
                    this.chunk.emit(OpCode.OP_DEFINE_LET, endVarIdx, stmt.pos);

                    const loopStart = this.chunk.instructions.length;
                    const loopCtx: LoopContext = {
                        continueJumps: [],
                        breakJumps: [],
                    };
                    this.loopStack.push(loopCtx);

                    // condition: variable < __end (or <= if inclusive)
                    this.chunk.emit(OpCode.OP_GET_VAR, varIdx, stmt.pos);
                    this.chunk.emit(OpCode.OP_GET_VAR, endVarIdx, stmt.pos);
                    if (stmt.iterable.inclusive) {
                        this.chunk.emit(OpCode.OP_LTE, undefined, stmt.pos);
                    } else {
                        this.chunk.emit(OpCode.OP_LT, undefined, stmt.pos);
                    }
                    const exitJump = this.chunk.emit(OpCode.OP_JUMP_IF_FALSE, 0, stmt.pos);

                    for (const s of stmt.body) {
                        this.compileStatement(s);
                    }

                    // Increment variable: variable = variable + 1
                    const continueStep = this.chunk.instructions.length;
                    loopCtx.continueTarget = continueStep;

                    this.chunk.emit(OpCode.OP_GET_VAR, varIdx, stmt.pos);
                    const oneIdx = this.chunk.addConstant(1);
                    this.chunk.emit(OpCode.OP_LOAD_CONST, oneIdx, stmt.pos);
                    this.chunk.emit(OpCode.OP_ADD, undefined, stmt.pos);
                    this.chunk.emit(OpCode.OP_SET_VAR, varIdx, stmt.pos);

                    this.chunk.emit(OpCode.OP_LOOP, loopStart, stmt.pos);
                    const loopEnd = this.chunk.instructions.length;
                    this.chunk.patchJump(exitJump, loopEnd);

                    for (const continueJump of loopCtx.continueJumps) {
                        this.chunk.patchJump(continueJump, continueStep);
                    }

                    for (const breakJump of loopCtx.breakJumps) {
                        this.chunk.patchJump(breakJump, loopEnd);
                    }

                    this.loopStack.pop();
                } else {
                    // Array iteration: for item in arr
                    this.compileExpression(stmt.iterable);
                    const arrVarName = `__arr_${stmt.variable}_${stmt.pos.line}_${stmt.pos.column}`;
                    const arrVarIdx = this.chunk.addConstant(arrVarName);
                    this.chunk.emit(OpCode.OP_DEFINE_LET, arrVarIdx, stmt.pos);

                    // Index variable
                    const zeroIdx = this.chunk.addConstant(0);
                    this.chunk.emit(OpCode.OP_LOAD_CONST, zeroIdx, stmt.pos);
                    const idxVarName = `__idx_${stmt.variable}_${stmt.pos.line}_${stmt.pos.column}`;
                    const idxVarIdx = this.chunk.addConstant(idxVarName);
                    this.chunk.emit(OpCode.OP_DEFINE_MUT, idxVarIdx, stmt.pos);

                    const loopStart = this.chunk.instructions.length;
                    const loopCtx: LoopContext = {
                        continueJumps: [],
                        breakJumps: [],
                    };
                    this.loopStack.push(loopCtx);

                    // condition: idx < arr.length
                    this.chunk.emit(OpCode.OP_GET_VAR, idxVarIdx, stmt.pos);
                    this.chunk.emit(OpCode.OP_GET_VAR, arrVarIdx, stmt.pos);
                    this.chunk.emit(OpCode.OP_ARRAY_LEN, undefined, stmt.pos);
                    this.chunk.emit(OpCode.OP_LT, undefined, stmt.pos);
                    const exitJump = this.chunk.emit(OpCode.OP_JUMP_IF_FALSE, 0, stmt.pos);

                    // item = arr[idx]
                    this.chunk.emit(OpCode.OP_GET_VAR, arrVarIdx, stmt.pos);
                    this.chunk.emit(OpCode.OP_GET_VAR, idxVarIdx, stmt.pos);
                    this.chunk.emit(OpCode.OP_GET_INDEX, undefined, stmt.pos);
                    const itemVarIdx = this.chunk.addConstant(stmt.variable);
                    this.chunk.emit(OpCode.OP_DEFINE_MUT, itemVarIdx, stmt.pos);

                    for (const s of stmt.body) {
                        this.compileStatement(s);
                    }

                    // Increment idx: idx = idx + 1
                    const continueStep = this.chunk.instructions.length;
                    loopCtx.continueTarget = continueStep;

                    this.chunk.emit(OpCode.OP_GET_VAR, idxVarIdx, stmt.pos);
                    const oneIdx = this.chunk.addConstant(1);
                    this.chunk.emit(OpCode.OP_LOAD_CONST, oneIdx, stmt.pos);
                    this.chunk.emit(OpCode.OP_ADD, undefined, stmt.pos);
                    this.chunk.emit(OpCode.OP_SET_VAR, idxVarIdx, stmt.pos);

                    this.chunk.emit(OpCode.OP_LOOP, loopStart, stmt.pos);
                    const loopEnd = this.chunk.instructions.length;
                    this.chunk.patchJump(exitJump, loopEnd);

                    for (const continueJump of loopCtx.continueJumps) {
                        this.chunk.patchJump(continueJump, continueStep);
                    }

                    for (const breakJump of loopCtx.breakJumps) {
                        this.chunk.patchJump(breakJump, loopEnd);
                    }

                    this.loopStack.pop();
                }
                break;
            }

            case "BreakStatement": {
                if (this.loopStack.length === 0) {
                    throw new BytecodeCompilationError("Break statement outside of loop", stmt.pos);
                }
                const currentLoop = this.loopStack[this.loopStack.length - 1]!;
                const jumpIdx = this.chunk.emit(OpCode.OP_JUMP, 0, stmt.pos);
                currentLoop.breakJumps.push(jumpIdx);
                break;
            }

            case "ContinueStatement": {
                if (this.loopStack.length === 0) {
                    throw new BytecodeCompilationError("Continue statement outside of loop", stmt.pos);
                }
                const currentLoop = this.loopStack[this.loopStack.length - 1]!;
                const jumpIdx = this.chunk.emit(OpCode.OP_JUMP, 0, stmt.pos);
                currentLoop.continueJumps.push(jumpIdx);
                break;
            }

            case "FunctionDeclaration": {
                this.functionDepth++;
                const fnBodyChunk = new Chunk();
                fnBodyChunk.constants = this.chunk.constants; // Share constants pool

                // Define params in function scope
                for (let i = stmt.parameters.length - 1; i >= 0; i--) {
                    const paramName = stmt.parameters[i]!;
                    const paramIdx = this.chunk.addConstant(paramName);
                    fnBodyChunk.emit(OpCode.OP_DEFINE_MUT, paramIdx, stmt.pos);
                }

                // Swap chunk to compile function body
                const outerChunk = this.chunk;
                const outerLoopStack = this.loopStack;
                this.chunk = fnBodyChunk;
                this.loopStack = [];

                for (const bodyStmt of stmt.body) {
                    this.compileStatement(bodyStmt);
                }

                // Default return null if no return statement
                const nullIdx = this.chunk.addConstant(null);
                fnBodyChunk.emit(OpCode.OP_LOAD_CONST, nullIdx, stmt.pos);
                fnBodyChunk.emit(OpCode.OP_RETURN, undefined, stmt.pos);

                // Restore outer chunk
                this.chunk = outerChunk;
                this.loopStack = outerLoopStack;
                this.functionDepth--;

                const fnIndex = this.chunk.functions.length;
                this.chunk.functions.push({
                    name: stmt.name,
                    arity: stmt.parameters.length,
                    instructions: fnBodyChunk.instructions,
                });

                const nameIdx = this.chunk.addConstant(stmt.name);
                const fnValIdx = this.chunk.addConstant({
                    type: "function",
                    name: stmt.name,
                    arity: stmt.parameters.length,
                    chunkIndex: fnIndex,
                });
                this.chunk.emit(OpCode.OP_LOAD_CONST, fnValIdx, stmt.pos);
                this.chunk.emit(OpCode.OP_DEFINE_LET, nameIdx, stmt.pos);
                break;
            }

            case "ReturnStatement": {
                if (this.functionDepth === 0) {
                    throw new BytecodeCompilationError("Return statement outside of function", stmt.pos);
                }
                if (stmt.argument) {
                    this.compileExpression(stmt.argument);
                } else {
                    const nullIdx = this.chunk.addConstant(null);
                    this.chunk.emit(OpCode.OP_LOAD_CONST, nullIdx, stmt.pos);
                }
                this.chunk.emit(OpCode.OP_RETURN, undefined, stmt.pos);
                break;
            }

            case "ExpressionStatement": {
                this.compileExpression(stmt.expression);
                this.chunk.emit(OpCode.OP_POP, undefined, stmt.pos);
                break;
            }
        }
    }

    private compileExpression(expr: Expression): void {
        switch (expr.type) {
            case "NumberLiteral": {
                const idx = this.chunk.addConstant(expr.value);
                this.chunk.emit(OpCode.OP_LOAD_CONST, idx, expr.pos);
                break;
            }

            case "StringLiteral": {
                const idx = this.chunk.addConstant(expr.value);
                this.chunk.emit(OpCode.OP_LOAD_CONST, idx, expr.pos);
                break;
            }

            case "BooleanLiteral": {
                const idx = this.chunk.addConstant(expr.value);
                this.chunk.emit(OpCode.OP_LOAD_CONST, idx, expr.pos);
                break;
            }

            case "Identifier": {
                if (expr.name === "null") {
                    const idx = this.chunk.addConstant(null);
                    this.chunk.emit(OpCode.OP_LOAD_CONST, idx, expr.pos);
                } else {
                    const idx = this.chunk.addConstant(expr.name);
                    this.chunk.emit(OpCode.OP_GET_VAR, idx, expr.pos);
                }
                break;
            }

            case "ArrayLiteral": {
                for (const el of expr.elements) {
                    this.compileExpression(el);
                }
                this.chunk.emit(OpCode.OP_BUILD_ARRAY, expr.elements.length, expr.pos);
                break;
            }

            case "IndexExpression": {
                this.compileExpression(expr.target);
                this.compileExpression(expr.index);
                this.chunk.emit(OpCode.OP_GET_INDEX, undefined, expr.pos);
                break;
            }

            case "BinaryExpression": {
                if (expr.operator === "and") {
                    // a and b: evaluate a; if false, jump to end (preserving false); else pop and evaluate b
                    this.compileExpression(expr.left);
                    this.chunk.emit(OpCode.OP_DUP, undefined, expr.pos);
                    const jumpFalseIdx = this.chunk.emit(OpCode.OP_JUMP_IF_FALSE, 0, expr.pos);
                    this.chunk.emit(OpCode.OP_POP, undefined, expr.pos);
                    this.compileExpression(expr.right);
                    const endIdx = this.chunk.instructions.length;
                    this.chunk.patchJump(jumpFalseIdx, endIdx);
                    break;
                }

                if (expr.operator === "or") {
                    // a or b: evaluate a; if true, jump to end (preserving true); else pop and evaluate b
                    this.compileExpression(expr.left);
                    this.chunk.emit(OpCode.OP_DUP, undefined, expr.pos);
                    const jumpTrueIdx = this.chunk.emit(OpCode.OP_JUMP_IF_TRUE, 0, expr.pos);
                    this.chunk.emit(OpCode.OP_POP, undefined, expr.pos);
                    this.compileExpression(expr.right);
                    const endIdx = this.chunk.instructions.length;
                    this.chunk.patchJump(jumpTrueIdx, endIdx);
                    break;
                }

                this.compileExpression(expr.left);
                this.compileExpression(expr.right);

                switch (expr.operator) {
                    case "+":
                        this.chunk.emit(OpCode.OP_ADD, undefined, expr.pos);
                        break;
                    case "-":
                        this.chunk.emit(OpCode.OP_SUB, undefined, expr.pos);
                        break;
                    case "*":
                        this.chunk.emit(OpCode.OP_MUL, undefined, expr.pos);
                        break;
                    case "/":
                        this.chunk.emit(OpCode.OP_DIV, undefined, expr.pos);
                        break;
                    case "//":
                        this.chunk.emit(OpCode.OP_IDIV, undefined, expr.pos);
                        break;
                    case "%":
                        this.chunk.emit(OpCode.OP_MOD, undefined, expr.pos);
                        break;
                    case "**":
                        this.chunk.emit(OpCode.OP_POW, undefined, expr.pos);
                        break;
                    case "==":
                        this.chunk.emit(OpCode.OP_EQ, undefined, expr.pos);
                        break;
                    case "!=":
                        this.chunk.emit(OpCode.OP_NEQ, undefined, expr.pos);
                        break;
                    case "<":
                        this.chunk.emit(OpCode.OP_LT, undefined, expr.pos);
                        break;
                    case "<=":
                        this.chunk.emit(OpCode.OP_LTE, undefined, expr.pos);
                        break;
                    case ">":
                        this.chunk.emit(OpCode.OP_GT, undefined, expr.pos);
                        break;
                    case ">=":
                        this.chunk.emit(OpCode.OP_GTE, undefined, expr.pos);
                        break;
                }
                break;
            }

            case "UnaryExpression": {
                this.compileExpression(expr.argument);
                if (expr.operator === "-") {
                    this.chunk.emit(OpCode.OP_NEG, undefined, expr.pos);
                } else if (expr.operator === "not") {
                    this.chunk.emit(OpCode.OP_NOT, undefined, expr.pos);
                }
                break;
            }

            case "CallExpression": {
                const argc = expr.arguments.length;

                // Check builtin registry
                if (BUILTINS_MAP.has(expr.callee)) {
                    const builtin = BUILTINS_MAP.get(expr.callee)!;
                    if (argc < builtin.arity[0] || argc > builtin.arity[1]) {
                        throw new BytecodeCompilationError(
                            `Built-in '${expr.callee}' expects between ${builtin.arity[0]} and ${builtin.arity[1]} arguments, got ${argc}`,
                            expr.pos
                        );
                    }
                    for (const arg of expr.arguments) {
                        this.compileExpression(arg);
                    }
                    const callInfoIdx = this.chunk.addConstant({
                        name: expr.callee,
                        argc,
                    });
                    this.chunk.emit(OpCode.OP_CALL_BUILTIN, callInfoIdx, expr.pos);
                    break;
                }

                // Check known user function declaration arity at compile time
                if (this.declaredFunctions.has(expr.callee)) {
                    const expectedArity = this.declaredFunctions.get(expr.callee)!;
                    if (argc !== expectedArity) {
                        throw new BytecodeCompilationError(
                            `Function '${expr.callee}' expects ${expectedArity} arguments, got ${argc}`,
                            expr.pos
                        );
                    }
                }

                // General function call
                for (const arg of expr.arguments) {
                    this.compileExpression(arg);
                }
                const calleeIdx = this.chunk.addConstant({
                    name: expr.callee,
                    argc,
                });
                this.chunk.emit(OpCode.OP_CALL, calleeIdx, expr.pos);
                break;
            }

            case "RangeExpression": {
                throw new BytecodeCompilationError("Range expressions only valid in for loops", expr.pos);
            }
        }
    }
}
