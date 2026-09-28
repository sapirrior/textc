export const ERROR_PROTOCOL = `ERROR PROTOCOL:
If the user input contains no algorithm, is impossible, contradictory, or invalid, output exactly:
TEXTC_ERROR_START
type: <ErrorName>
message: <short clear description>
line: <line number in input>
column: <column number in input>
hint: <helpful guidance>
TEXTC_ERROR_END

Standard Error Types:
- SyntaxError: Input grammar or structure is unparseable
- DataError: Missing required data, invalid numbers, or incorrect collections
- AmbiguityError: Conflicting steps or missing operational definitions`;
