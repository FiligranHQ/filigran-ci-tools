# PR Title Check Action

Reusable GitHub Action to validate PR titles against [Conventional Commits](https://www.conventionalcommits.org/) and create a check run.

## Features
- Validates PR titles against Conventional Commits: `type(scope?)!?: description (#123)`
- Skips validation for Renovate PRs
- Diagnoses common formatting errors
- Creates a custom check run with the result

## Usage

### 1. Token Generation
**Important:** This action does NOT handle GitHub App token generation. You must generate a token in your workflow before using this action. For example, you can use `actions/create-github-app-token` or another method to obtain a `GITHUB_TOKEN` with appropriate permissions.

### 2. Example Workflow
```yaml
name: "PR Title Check"
on:
  pull_request:
    types: [opened, edited, reopened, ready_for_review, synchronize]
jobs:
  validate-pr-title:
    runs-on: ubuntu-latest
    steps:
      - name: Generate a token
        id: generate-token
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ secrets.YOUR_APP_ID }}
          private-key: ${{ secrets.YOUR_PRIVATE_KEY }}
      - name: Validate PR title and create check
        uses: FiligranHQ/filigran-ci-tools/actions/pr-title-check@main
        with:
          token: ${{ steps.generate-token.outputs.token }}
```

### 3. Inputs
- `token`: The token generated in the previous step (must have `checks:write` permission)

## Required PR Title Format
```
type(scope?)!?: description (#123)
```
- `type` is one of: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `revert`
- `scope` is optional, a lowercase noun in parentheses describing a section of the codebase
- `!` is optional, indicates a breaking change
- `description` must start with a lowercase letter
- `(#123)` is a required issue reference at the end

### Examples
- `feat(auth): add login endpoint (#42)`
- `fix: resolve array parsing issue (#99)`
- `feat(api)!: remove deprecated endpoints (#150)`
- `docs: update contributing guide (#7)`

## Notes
- The action will not fail the job (it uses `continue-on-error: true`).
- If the PR is from a fork, the check run will not be created.
- You must handle token generation in your workflow.
