'use strict';

// Reads title, body and the same-repo issues linked in the Development panel.
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

module.exports = { getPullRequest };
