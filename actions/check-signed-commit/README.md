# Check Signed Commits in PR Action

Reusable GitHub Action to check that all commits in a pull request are signed.

## Features
- Checks that all commits in a PR are PGP-signed
- Posts a comment if unsigned commits are found
- Provides information on how to sign commits

## Usage

### Example Workflow
```yaml
name: "Check Signed Commits in PR"
on: pull_request_target
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

### Inputs
- `comment`: (optional) Comment to post if unsigned commits are found. Default provided.

## Notes
- This action wraps [1Password/check-signed-commits-action](https://github.com/1Password/check-signed-commits-action).
- For more information on signing commits, see: https://docs.github.com/en/authentication/managing-commit-signature-verification/signing-commits
