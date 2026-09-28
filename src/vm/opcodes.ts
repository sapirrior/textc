/**
 * TextC VM Bytecode Operations
 */
export enum OpCode {
    // Constant & Stack Operations
    OP_LOAD_CONST = 0x01,
    OP_POP = 0x02,
    OP_DUP = 0x03,

    // Variable Operations
    OP_DEFINE_LET = 0x10,
    OP_DEFINE_MUT = 0x11,
    OP_GET_VAR = 0x12,
    OP_SET_VAR = 0x13,

    // Arithmetic Operations
    OP_ADD = 0x20,
    OP_SUB = 0x21,
    OP_MUL = 0x22,
    OP_DIV = 0x23,
    OP_MOD = 0x24,
    OP_NEG = 0x25,

    // Comparison Operations
    OP_EQ = 0x30,
    OP_NEQ = 0x31,
    OP_LT = 0x32,
    OP_LTE = 0x33,
    OP_GT = 0x34,
    OP_GTE = 0x35,

    // Logical Operations
    OP_AND = 0x40,
    OP_OR = 0x41,
    OP_NOT = 0x42,

    // Control Flow
    OP_JUMP = 0x50,
    OP_JUMP_IF_FALSE = 0x51,
    OP_JUMP_IF_TRUE = 0x52,
    OP_LOOP = 0x53,

    // Functions
    OP_CALL = 0x60,
    OP_RETURN = 0x61,

    // Data Structures (Arrays & Strings)
    OP_BUILD_ARRAY = 0x70,
    OP_GET_INDEX = 0x71,
    OP_SET_INDEX = 0x72,
    OP_ARRAY_PUSH = 0x73,
    OP_ARRAY_POP = 0x74,
    OP_ARRAY_LEN = 0x75,
    OP_ARRAY_SORT = 0x76,
    OP_ARRAY_REVERSE = 0x77,
    OP_ARRAY_SWAP = 0x78,
    OP_ARRAY_SLICE = 0x79,
    OP_ARRAY_CONTAINS = 0x7a,
    OP_ARRAY_INDEX_OF = 0x7b,
    OP_ARRAY_FILL = 0x7c,
    OP_ARRAY_SUM = 0x7d,

    // Built-in Math & System Calls
    OP_MATH_CALL = 0x80,
    OP_PRINT = 0x90,

    // VM Termination
    OP_HALT = 0xff,
}
