import { Position } from "../ir/ast";
import { OpCode } from "./opcodes";

export type VmPrimitive = number | string | boolean | null;

export type VmValue =
    | VmPrimitive
    | VmArray
    | VmFunction;

export type VmArray = VmValue[];

export interface VmFunction {
    type: "function";
    name: string;
    arity: number;
    chunkIndex: number;
}

export interface Instruction {
    op: OpCode;
    operand?: number;
    pos: Position;
}

export interface VariableBinding {
    value: VmValue;
    mutable: boolean;
}
