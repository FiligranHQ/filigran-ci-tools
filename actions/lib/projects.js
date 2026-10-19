'use strict';

// Reads the project's Status field and its options.
async function getStatusField(github, project) {
  const { organization } = await github.graphql(`
    query($owner: String!, $number: Int!) {
      organization(login: $owner) {
        projectV2(number: $number) {
          id
          field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } }
        }
      }
    }`, { owner: project.owner, number: project.number });
  const projectV2 = organization.projectV2;
  return { projectId: projectV2.id, fieldId: projectV2.field.id, options: projectV2.field.options };
}

// Reads the issue's item and status in the project; null when the issue is not in it.
async function getIssueItem(github, repo, number, project) {
  const { repository } = await github.graphql(`
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          projectItems(first: 20) {
            nodes {
              id
              project { number owner { ... on Organization { login } ... on User { login } } }
              fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
            }
          }
        }
      }
    }`, { ...repo, number });
  const item = repository.issue.projectItems.nodes
    .find((i) => i.project.owner.login === project.owner && i.project.number === project.number);
  return item ? { id: item.id, status: item.fieldValueByName?.name ?? null } : null;
}

// Sets the item's Status by option name.
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

module.exports = { getStatusField, getIssueItem, setStatus };
