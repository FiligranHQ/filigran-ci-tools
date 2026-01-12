# PR Title Check Action

Reusable GitHub Action to validate PR titles and create a check run.

## Features
- Validates PR titles for format: `[category/subcategory] type(scope?): description (#123)`
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
          github_token: ${{ steps.generate-token.outputs.token }}
```

### 3. Inputs
- `github_token`: The token generated in the previous step (must have `checks:write` permission)

## Required PR Title Format
```
[category/subcategory] type(scope?): description (#123)
```
- Example: `[core/api] feat(auth): add login endpoint (#42)`

## Notes
- The action will not fail the job (it uses `continue-on-error: true`).
- If the PR is from a fork, the check run will not be created.
- You must handle token generation in your workflow.
