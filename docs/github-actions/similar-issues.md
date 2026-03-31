# `similar-issues.yml`

## Function

Uses GitHub Models and GitHub MCP to find similar issues and comment on newly opened issues with possible matches.

## Trigger

- `issues` event with type `opened`

## Affected Modules

- GitHub issue triage workflow
- `.github/prompts/similar_issues.prompt.yml`

## Inputs, Secrets, Environment

- Secret: `GITHUB_TOKEN`
- Secret: `USER_PAT`
- External endpoint: `https://models.github.ai/orgs/RSSNext/inference`

## Flow Logic

1. Checkout repository.
2. Extract issue title and body from the event payload.
3. Normalize multiline body text for YAML-safe prompt injection.
4. Call `actions/ai-inference` with:
   - prompt file from `.github/prompts/similar_issues.prompt.yml`
   - repository name
   - issue title and body
   - GitHub MCP enabled
5. Parse model response JSON.
6. Filter out the current issue if it appears in the result set.
7. Format up to three matching issues into a comment body.
8. Post the comment back to the issue when matches exist.

## Outputs and Side Effects

- AI-generated comment on a new issue with similar issue links

## Notes

- This workflow is operational tooling around repository support, not application CI.
