'use strict';

const isNotFound = (err) => err.errors?.length > 0 && err.errors.every((e) => e.type === 'NOT_FOUND');

async function getPullRequest(github, repo, number) {
  const { repository } = await github.graphql(`
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          title
          body
          closingIssuesReferences(first: 50) {
            nodes { number repository { name owner { login } } }
          }
        }
      }
    }`, { ...repo, number });
  const pr = repository.pullRequest;
  const linked = pr.closingIssuesReferences.nodes
    .filter((i) => i.repository.owner.login === repo.owner && i.repository.name === repo.repo)
    .map((i) => i.number);
  return { title: pr.title, body: pr.body ?? '', linked };
}

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

async function getStatusField(github, owner, projectNumber) {
  const { organization } = await github.graphql(`
    query($owner: String!, $number: Int!) {
      organization(login: $owner) {
        projectV2(number: $number) {
          id
          field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } }
        }
      }
    }`, { owner, number: projectNumber });
  const project = organization.projectV2;
  return { projectId: project.id, fieldId: project.field.id, options: project.field.options };
}

// Returns null when the number is not an issue of the repo (e.g. a pull request).
async function getIssue(github, repo, number, project) {
  let repository;
  try {
    ({ repository } = await github.graphql(`
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            state
            milestone { title }
            labels(first: 50) { nodes { name } }
            projectItems(first: 20) {
              nodes {
                id
                project { number owner { ... on Organization { login } ... on User { login } } }
                fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
              }
            }
          }
        }
      }`, { ...repo, number }));
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
  const issue = repository.issue;
  const item = issue.projectItems.nodes
    .find((i) => i.project.owner.login === project.owner && i.project.number === project.number);
  return {
    state: issue.state,
    milestone: issue.milestone?.title ?? null,
    labels: issue.labels.nodes.map((l) => l.name),
    itemId: item?.id ?? null,
    status: item?.fieldValueByName?.name ?? null,
  };
}

async function setStatus(github, field, itemId, status) {
  const option = field.options.find((o) => o.name === status);
  if (!option) throw new Error(`Status option "${status}" not found on the Status field.`);
  await github.graphql(`
    mutation($project: ID!, $item: ID!, $field: ID!, $value: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $project, itemId: $item, fieldId: $field, value: { singleSelectOptionId: $value }
      }) { projectV2Item { id } }
    }`, { project: field.projectId, item: itemId, field: field.fieldId, value: option.id });
}

async function comment(github, repo, number, body) {
  await github.rest.issues.createComment({ ...repo, issue_number: number, body });
}

async function addLabel(github, repo, number, label) {
  await github.rest.issues.addLabels({ ...repo, issue_number: number, labels: [label] });
}

async function closeIssue(github, repo, number) {
  await github.rest.issues.update({ ...repo, issue_number: number, state: 'closed', state_reason: 'completed' });
}

async function findMilestone(github, repo, title) {
  const milestones = await github.paginate(github.rest.issues.listMilestones, { ...repo, state: 'all', per_page: 100 });
  return milestones.find((m) => m.title === title) ?? null;
}

async function setMilestone(github, repo, number, milestoneNumber) {
  await github.rest.issues.update({ ...repo, issue_number: number, milestone: milestoneNumber });
}

module.exports = {
  getPullRequest, getCloser, getStatusField, getIssue, setStatus, comment, addLabel, closeIssue, findMilestone, setMilestone,
};
