# `translator.yml`

## Function

Automatically translates issues, issue comments, discussions, and discussion comments for repository collaboration.

## Trigger

- `issues`: `opened`, `edited`
- `issue_comment`: `created`, `edited`
- `discussion`: `created`, `edited`
- `discussion_comment`: `created`, `edited`

## Affected Modules

- GitHub collaboration workflow
- Community communication on issues and discussions

## Inputs, Secrets, Environment

- Secret: `GITHUB_TOKEN`

## Flow Logic

1. Checkout repository.
2. Run `lizheming/github-translate-action`.
3. Allow the action to modify titles as well as body content.
4. The action updates the target GitHub content in place.

## Outputs and Side Effects

- Translated content or translated title metadata on supported GitHub discussion surfaces

## Notes

- This workflow affects GitHub content only.
- It has no impact on repository build, test, or release behavior.
