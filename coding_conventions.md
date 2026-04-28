# Coding Conventions

## General Principles
- Readability and maintainability first, then performance, then brevity.
- Favor explicit over implicit. No magic.
- Fail fast and loudly on errors.
- All public APIs must have clear input validation and documented error cases.
- Never commit code that breaks existing functionality without a migration plan.

## Naming Conventions
- Variables/functions: camelCase (JS/TS) or snake_case (Python) — be consistent with stack.
- Components/Classes: PascalCase.
- Constants: UPPER_SNAKE_CASE.
- Files: kebab-case for components/pages, descriptive for utilities.
- Avoid abbreviations unless universally understood (e.g., URL, ID).

## Code Style
- Use strict mode / type checking where available (TypeScript strict, Python type hints + mypy).
- Maximum line length: 100 characters.
- Functions should do one thing well (single responsibility).
- No deeply nested conditionals — extract early returns or helper functions.
- Prefer immutable data where practical.

## Error Handling
- Never swallow errors silently.
- Use custom error classes or Result<T, E> pattern when appropriate.
- All async functions must handle and propagate errors properly.
- Log meaningful context (not just stack traces).

## Testing
- Unit tests for pure logic.
- Integration tests for external interactions.
- Always test happy path + main error/edge cases.
- Aim for ≥70% coverage on new code; 100% on critical paths.

## Documentation
- Every non-obvious function/module gets a short comment explaining "why", not just "what".
- Key architectural decisions must be recorded in this file or project_brief.md.

## Security & Secrets
- Never hardcode credentials, API keys, or sensitive data.
- Use environment variables with validation at startup.
- Sanitize all user input.

## Refactoring Rules
- If code smells (duplication >3x, god functions, magic numbers), flag it and propose refactor before adding new features.
- Never leave TODOs without a concrete plan and owner (me).

## What to Avoid
- Over-engineering simple features.
- Adding dependencies for trivial tasks.
- Ignoring performance until "later".
- Writing code I am unlikely to maintain in 6 months.

Reference this file explicitly when generating or reviewing code.