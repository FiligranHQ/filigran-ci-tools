# Sync Project Status on PR Merge

Composite action: on PR merge, syncs the **Status** field of the linked issues'
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

Any other combination: no action taken (logged as `ℹ️`).

## Inputs

| Name | Required | Default | Description |
|---|:---:|---|---|
| `token` | ✅ | — | Token used for all `gh` calls (REST + GraphQL). |
| `project-owner` | ❌ | `OpenAEV-Platform` | Org owning the Project v2. |
| `project-number` | ❌ | `2` | Project v2 number. |
| `feature-flag-label` | ❌ | `feature-flag` | Label indicating a feature flag on the issue. |
| `target-milestone` | ❌ | `0. Candidate` | Milestone to assign (never created). |
| `pr-number` | ❌ | `''` | Force processing of a specific PR (manual testing). |

## Required permissions

- **Issues**: read/write (labels, close, milestone, comments)
- **Projects (org)**: read/write (Status field, GraphQL only)

## Limitations

- **Same-repo** issue resolution only (`#123`, no `owner/repo#123`).
- Only triggered on `pull_request: closed` merged into `main`.
- Never creates a missing milestone (logs a warning and skips).

## Testing

No unit tests — validated manually via a test PR against a dummy issue, checking
Project status, `solved` label, closure, and milestone after merge.