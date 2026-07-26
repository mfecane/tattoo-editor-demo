---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# Code style

- entities, exported interfaces, classes, enums should be split into separate file, where file name = entity name
- prefer initialization of class members outside of constructor if possible
- sort class members and methods by private/public and importance, keep fields above constructor, methods below constructor
- add type annotations to all const and let variables, except explicitly assigned as constructed class instance or string/boolean/number literal
- classes marked with injectable and singleton can be injected without usage of inject decorator
- avoid single use variables
- Use absolute file imports
- Do not wrap class parameters into object structures
- Do not apply stylistic changes to already existing unchanged code. Do not create meninless diffs. i.e. no whitespace cleanup for existing unchanged lines.

# Classes

- use all possible shortcuts for class fields declarations and initializations (declare in constructor parameters, assign in declaration line)
- declare settings, magic strings, constants in public/private static readonly fields
- no static methods

# Debug

- For debugging logs, only use simple plain
  - `console.log('<variable name>', <variable>)`

- Only if asked explicitly to log call stack trace use
  - `console.groupCollapsed('<entity name>', <optional variable value>)`, followed by `console.trace()` and `console.groupEnd()`.

- All debug logs should be instantly deletable not affecting surrounding code. If needed to debug function call result, prefer not to put result into variable, but call function inside log statement.

# Comments

- Do not put comments to new generated code
- Do not remove already existing comments unless explicitly asked

#  Common LLM shit

- never add explicit void before function call
