'use strict';

const isNotFound = (err) => err.errors?.length > 0 && err.errors.every((e) => e.type === 'NOT_FOUND');

// Reads state, milestone and labels; null when the number is not an issue (e.g. a PR).
async function getIssue(github, repo, number) {
  let repository;
  try {
    ({ repository } = await github.graphql(`
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            state
            milestone { title }
            labels(first: 50) { nodes { name } }
          }
        }
      }`, { ...repo, number }));
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
  const issue = repository.issue;
  return {
    state: issue.state,
    milestone: issue.milestone?.title ?? null,
    labels: issue.labels.nodes.map((l) => l.name),
  };
}

// Type of what closed the issue last (PullRequest, Commit) or null when closed by hand.
async function getCloser(github, repo, number) {
  const { repository } = await github.graphql(`
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          timelineItems(last: 1, itemTypes: [CLOSED_EVENT]) {
            nodes { ... on ClosedEvent { closer { __typename } } }
          }
        }
      }
    }`, { ...repo, number });
  return repository.issue.timelineItems.nodes[0]?.closer?.__typename ?? null;
}

// Posts a comment on the issue.
async function comment(github, repo, number, body) {
  await github.rest.issues.createComment({ ...repo, issue_number: number, body });
}

// Adds one label to the issue.
async function addLabel(github, repo, number, label) {
  await github.rest.issues.addLabels({ ...repo, issue_number: number, labels: [label] });
}

// Closes the issue as completed.
async function closeIssue(github, repo, number) {
  await github.rest.issues.update({ ...repo, issue_number: number, state: 'closed', state_reason: 'completed' });
}

module.exports = { getIssue, getCloser, comment, addLabel, closeIssue };
