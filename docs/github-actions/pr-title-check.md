# `pr-title-check.yml`

## Function

Validates pull request titles against the repository’s conventional-commit style.

## Trigger

- Pull request events:
  - `opened`
  - `synchronize`
  - `reopened`
  - `edited`

## Affected Modules

- Pull request review process
- Release / changelog hygiene

## Inputs, Secrets, Environment

- No custom project secret declared
- Uses the PR title from GitHub event payload

## Flow Logic

1. Run on PR metadata changes.
2. Use `ytanikin/PRConventionalCommits`.
3. Validate title against allowed task types:
   - `feat`
   - `fix`
   - `docs`
   - `test`
   - `ci`
   - `refactor`
   - `perf`
   - `chore`
   - `revert`
   - `release`
   - `build`

## Outputs and Side Effects

- PR check status reflecting whether the title matches the expected convention

## Notes

- This workflow enforces contribution hygiene, not application behavior.
