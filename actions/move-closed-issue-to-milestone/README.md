# 🏷️ move-closed-issue-to-milestone

> When an issue is closed with one of the configured labels, automatically assigns it to a target milestone.

---

## Overview

This action listens to `issues` events (type `closed`) and moves matching issues to a given milestone.
An issue matches when it carries **at least one** of the configured source labels.
If the target milestone does not exist yet, it is created automatically.

---

## Inputs

| Input | Required | Description |
|---|---|---|
| `source-labels` | ✅ | Comma-separated list of labels to match (e.g. `"bug,critical"`) |
| `target-milestone` | ✅ | Title of the milestone to assign the issue to |
| `issue-number` | ❌ | Issue number override — useful for manual/workflow\_dispatch testing |

---

## Usage

### Minimal example

```yaml
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
          source-labels: "bug"
          target-milestone: "0. Candidate"
```

### Multiple labels

```yaml
- name: Move issue to milestone
  uses: FiligranHQ/filigran-ci-tools/actions/move-closed-issue-to-milestone@main
  with:
    source-labels: "bug,critical,regression"
    target-milestone: "0. Candidate"
```

### Manual trigger for testing

```yaml
name: "[Shared] Move closed issue to milestone"

on:
  issues:
    types: [closed]
  workflow_dispatch:
    inputs:
      issue-number:
        description: "Issue number to process manually"
        required: true

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
          issue-number: ${{ inputs.issue-number }}
```

---

## Behaviour

| Condition | Result |
|---|---|
| Issue has at least one matching label | Assigned to `target-milestone` |
| Issue has no matching label | Skipped (no error) |
| Target milestone does not exist | Created automatically, then assigned |
| No issue in event payload | Skipped (no error) |

---

## Permissions

The workflow calling this action must declare:

```yaml
permissions:
  issues: write
```

---

## Files

| File | Role |
|---|---|
| `action.yml` | Action definition and entry point |
| `logic.js` | Pure decision function — determines whether an issue should be moved |
| `api.js` | GitHub API calls — fetch issue, find/create milestone, assign milestone |
| `logic.test.js` | Unit tests for the decision logic (Node.js built-in test runner) |

---

## Running tests locally

```bash
node --test actions/move-closed-issue-to-milestone/logic.test.js
```
