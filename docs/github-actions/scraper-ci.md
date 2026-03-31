# `scraper-ci.yml`

## Function

Runs Python tests for the scraper service when scraper code changes in a pull request.

## Trigger

- Pull request changes under `apps/scraper/**`

## Affected Modules

- `apps/scraper`
- Python scraper implementations
- Scraper test suite

## Inputs, Secrets, Environment

- No custom project secrets required

## Flow Logic

1. Checkout repository.
2. Setup Python `3.11`.
3. Restore pip cache using `apps/scraper/requirements.txt`.
4. Install scraper dependencies with `pip install -r apps/scraper/requirements.txt`.
5. Run `pytest tests/ -v` inside `apps/scraper`.

## Outputs and Side Effects

- CI validation for scraper service correctness

## Notes

- This is the cleanest isolated workflow in the repo.
- It does not depend on Node, Turbo, or the rest of the monorepo build graph.
