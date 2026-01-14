# Auto Label GitHub Action

Automatically add labels to pull requests or issues based on the author's organization membership.

## Inputs

- `github_token` (**required**): GitHub token with repo scope.
- `labels_by_organization` (optional): A JSON string mapping organization names to arrays of labels. Defaults to `{ "FiligranHQ": ["filigran team"] }`.
  Example:
  ```json
  { "my-org": ["internal", "trusted"], "other-org": ["external"] }
  ```
- `repository` (optional): The owner/repo name. Defaults to `${{ github.repository }}`.

## How it works

- For each organization in `labels_by_organization`, if the PR/issue author is a member, the corresponding labels are added to the PR/issue.
- Requires the GitHub CLI (`gh`) and `jq` to be available in the runner (the action installs `jq` if needed).

## Example usage

```yaml
- name: Auto Label
  uses: FiligranHQ/filigran-ci-tools/actions/auto-label@main
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    # labels_by_organization is optional, defaults to {"FiligranHQ": ["filigran team"]}
    # labels_by_organization: '{"my-org": ["internal"], "other-org": ["external"]}'
```

## Notes
- Only works for PRs/issues created by users who are members of the specified organizations.
- The action does not remove labels, only adds them.
- The action must have permission to add labels to the target repository.
