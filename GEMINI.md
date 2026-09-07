# Gemini CLI Core Mandates

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Contextual Precedence

The instructions in this file are foundational and take absolute precedence over general workflows for the Gemini CLI.

## Workflow Priorities

1. **Security First**: Protect `.env`, `.git`, and system configs. Never commit secrets.
2. **Context Efficiency**: Combine tool calls. Use `wait_for_previous: true` only when necessary.
3. **Engineering Integrity**: Adhere to existing patterns. Wrap atomic, multi-write DB operations in `db.transaction` and always adjust wallet balances within the same transaction.
4. **Validation**: Run `cargo check -p api`, `cd apps/dashboard && pnpm tsc`, or `vitest run` after changes.

## Testing Strategy & TDD

- **TDD Cycle**: Mandatory Red-Green-Refactor cycle for all new development.
- **API-Heavy Philosophy**: Prioritize testing backend logic over frontend UI.
  - **Rust Backend**: Heavy emphasis on core logic unit testing (`keiri_core`) and API endpoint integration testing using `rstest`. Parameterize edge cases for all financial math.
  - **TypeScript Frontend**: Use `vitest` strictly for headless utility functions, state, and complex hooks in `apps/dashboard`. Do NOT write UI component tests or browser-based E2E tests unless explicitly requested.
- **Function Coverage**: Create comprehensive tests for EVERY new backend function before it is considered complete.

## Performance Optimization

- **Parallelism**: Run independent search/read/edit tasks in the same turn.
- **Surgical Edits**: Use `replace` with enough context to avoid ambiguity.
- **Discovery**: Prefer `grep_search` and `glob` over manual traversal.

## Constraints & Standards

- **No Filler**: Keep responses concise and technical.
- **Dependency Audit**: Verify established usage in `package.json`/`Cargo.toml` before adding libs.
- **Atomic Commits**: Fulfill the request thoroughly, including related tests and verification logic.
- **Commit Messages**: CLEAR, CONCISE, and focused on "WHY". Propose draft messages to the user.
