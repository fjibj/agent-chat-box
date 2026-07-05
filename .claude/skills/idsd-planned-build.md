# Skill: idsd-planned-build

## Trigger
User invokes `/start-planned-feature` or asks to run a planned IDSD build for a GAP/intent.

## Input
- An intent directory under `idsd-pilot/<gap>/idsd/intents/<intent-name>/` containing:
  - `intent.md` with Goal, Constraints, Failure Conditions
  - `expectations.md` with success/failure/boundary scenarios
- Optional: a `PROJECT_PROFILE.md` and `CLAUDE.md` in the pilot directory or project root.

## Execution Rules
1. Read the intent and expectations files for the requested GAP.
2. Read `PROJECT_PROFILE.md`, `CLAUDE.md`, and `AGENTS.md` from the pilot directory (or project root if absent).
3. Read the referenced source files to assemble full context.
4. Plan the implementation autonomously — do not ask the user design questions.
5. **Language: All IDSD artifacts (plan files, intent/expectations updates, status files, handoff notes, evaluation reports) must be written in Simplified Chinese. Code comments remain in English to match the existing codebase.**
6. Implement in minimal vertical slices:
   - Slice 1: data model / API change
   - Slice 2: integration / broadcast
   - Slice 3: tests (automated + holdout scenarios)
7. Run relevant tests after every slice.
8. After implementation, run `holdout/evaluate.py <version-tag>`.
9. If evaluation fails, analyze and rebuild (max 3 loops).
10. Update `idsd-pilot/<gap>/idsd/idsd-status.yaml` after each completed slice.

## Prohibitions
- Do not read or modify `holdout/scenarios/` files directly.
- Do not read or modify `.claudeignore`.
- Do not run `git commit`/`git push` unless explicitly asked.
- Do not add dependencies without explicit approval.
- Do not break existing API contracts.
