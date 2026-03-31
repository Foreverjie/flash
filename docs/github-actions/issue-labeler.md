# `issue-labeler.yml`

## Function

Automatically applies labels to newly opened issues based on the issue form payload.

## Trigger

- `issues` event with type `opened`

## Affected Modules

- GitHub issue triage process
- `.github/ISSUE_TEMPLATE/bug_report.yml`

## Inputs, Secrets, Environment

- Uses `secrets.GITHUB_TOKEN`

## Flow Logic

1. Checkout repository.
2. Parse the opened issue against `.github/ISSUE_TEMPLATE/bug_report.yml`.
3. Pass parsed issue form JSON into `advanced-issue-labeler`.
4. Apply labels based on the issue form fields.

## Outputs and Side Effects

- Labels added to new GitHub issues

## Notes

- This workflow does not affect application code or build output.
- It is a repository operations workflow.
