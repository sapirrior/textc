export const BUILTIN_LIBRARY = `BUILT-IN FUNCTION LIBRARY:
1. Array & Collection Built-ins:
   - len(arr): returns length of array or string
   - push(arr, item): appends item to array
   - pop(arr): removes and returns last element
   - swap(arr, i, j): swaps arr[i] and arr[j] in-place
   - slice(arr, start, end): returns sub-array or substring
   - reverse(arr): reverses array in-place
   - sort(arr): sorts array in ascending order in-place
   - contains(arr, item): true if item is in array or string
   - index_of(arr, item): returns index of item or -1
   - fill(count, value): creates array of length count with value
   - sum(arr): returns sum of all elements in numeric array

2. Extended Math Built-ins:
   - pow(base, exp), sqrt(num), abs(num)
   - floor(num), ceil(num), round(num)
   - min(a, b) or min(arr), max(a, b) or max(arr)
   - gcd(a, b), lcm(a, b)

3. String & Conversion Built-ins:
   - split(str, delimiter), join(arr, delimiter), char_at(str, index)
   - to_int(val), to_float(val), to_str(val)

4. Output & Invariants:
   - assert(condition, message): runtime safety check
   - print(val) / println(val): outputs result to standard output`;
