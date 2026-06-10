# filigran-ci-tools

GitHub Actions for Filigran projects.

## Actions
- `pr-title-check`: Ensures PR titles follow Filigran conventions.
- `check-signed-commit`: Requires all PR commits to be signed.
- `auto-label`: Automatically labels PRs based on rules.
- `move-closed-issue-to-milestone`: When a closed issue has the configured labels, moves it to the target milestone.

## Usage Examples

```
name: "[OAEV Shared] Auto Label"
on:
  pull_request:
    branches: [main, release/current]
    types: [opened, reopened]
permissions:
  contents: read
  pull-requests: write
jobs:
  auto-label:
    runs-on: ubuntu-latest
    steps:
      - name: "Auto Label"
        uses: FiligranHQ/filigran-ci-tools/actions/auto-label@main
```

```
name: "[OAEV Shared] Check Signed Commits in PR"
on:
  pull_request_target:
    branches: [main, release/current]
permissions:
  contents: read
  pull-requests: write
jobs:
  check-signed-commits:
    runs-on: ubuntu-latest
    steps:
      - name: Check signed commits in PR
        uses: FiligranHQ/filigran-ci-tools/actions/check-signed-commit@main
```

```
name: "[OAEV Shared] Validate PR title Worker"
on:
  pull_request:
    branches: [main, release/current]
    types: [opened, edited, reopened, ready_for_review, synchronize]
jobs:
  validate-pr-title:
    runs-on: ubuntu-latest
    steps:
      - name: "Generate a token"
        id: generate-token
        if: github.event.pull_request.head.repo.full_name == github.repository
        uses: actions/create-github-app-token@v2
        with:
          app-id: ${{ secrets.OPENAEV_PR_CHECKS_APP_ID }}
          private-key: ${{ secrets.OPENAEV_PR_CHECKS_PRIVATE_KEY }}
      - name: "Validate PR title and create check"
        uses: FiligranHQ/filigran-ci-tools/actions/pr-title-check@main
        with:
          token: ${{ steps.generate-token.outputs.token }}

```

```
name: "[Shared] Move closed issue to milestone"
on:
  issues:
    types: [closed]
permissions:
  issues: write
jobs:
  move-to-milestone:
    runs-on: ubuntu-latest
    steps:
      - name: Move issue to milestone
        uses: FiligranHQ/filigran-ci-tools/actions/move-closed-issue-to-milestone@main
        with:
          source-labels: "bug,critical"
          target-milestone: "0. Candidate"
```
