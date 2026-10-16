# Sync Project Status on PR Merge

Composite action: on PR merge or manual issue close, syncs the **Status** field of the linked issues'
GitHub Project v2, based on the `feature-flag` label present **on the issue**
(never on the PR). Closes the issue, adds the `solved` label, and assigns the
milestone when the transition requires it.

Workflow: `.github/workflows/sync-status-on-merge.yml` ("[OpenAEV] Sync Project
Status on PR Merge").

## Transition logic

| `feature-flag` | Current status | New status | Closes | `solved` | Milestone | Comment |
|---|---|---|:---:|:---:|:---:|:---:|
| ✅ | `In review` | `Test PO main-ff` | ❌ | ❌ | ❌ | ❌ |
| ✅ | `Ready to remove FF` | `Final product validation` | ✅ | ✅ | ✅ | ❌ |
| ❌ | `Ready to merge` | `Final product validation` | ✅ | ✅ | ✅ | ❌ |
| ❌ | `In review` | `Done` | ✅ | ✅ | ✅ | ⚠️ "not tested" |
| ❌ | `Done` / `Final product validation` | unchanged | ✅ | ✅ | ✅ | ❌ |
| ❌ | any other, except `*main-ff*` | `fallback-status` | ✅ | ✅ | ✅ | ❌ |

Any other combination: no action taken (logged as `ℹ️`).

A milestone starting with `Release` is never replaced.

Linked issues: `(#n)` at the end of the PR title, `Closes/Fixes/Resolves #n`, and
issues linked in the PR's Development panel. The PR's own number is ignored, and
numbers that are not issues are skipped.

On `issues: closed` (manual close, as completed, by a user): same rules, except
`feature-flag` + `In review`. Issues closed by a PR or a bot are skipped.

## Inputs

| Name | Required | Default | Description |
|---|:---:|---|---|
| `token` | ✅ | — | Token used for all GitHub calls (REST + GraphQL). |
| `project-owner` | ✅ | — | Org owning the Project v2. |
| `project-number` | ✅ | — | Project v2 number. |
| `feature-flag-label` | ❌ | `feature-flag` | Label indicating a feature flag on the issue. |
| `target-milestone` | ❌ | `0. Candidate` | Milestone to assign (never created). |
| `fallback-status` | ❌ | `Final product validation` | Status for issues whose status matches no rule. |
| `pr-number` | ❌ | `''` | Force processing of a specific PR (manual testing). |

## Required permissions

- **Issues**: read/write (labels, close, milestone, comments)
- **Pull requests**: read (title, body, linked issues)
- **Projects (org)**: read/write (Status field, GraphQL only)

## Limitations

- **Same-repo** issue resolution only (`#123`, no `owner/repo#123`).
- Triggered on `pull_request: closed` merged into `main`, and on `issues: closed`
  when the calling workflow listens to it.
- Never creates a missing milestone (logs a warning and skips).

## Testing

`logic.js` holds the rules, `api.js` the GitHub calls. Run the rule tests with:

```bash
node --test actions/sync-status-on-merge/logic.test.js
```