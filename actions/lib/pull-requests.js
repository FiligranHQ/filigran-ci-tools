'use strict';

// Reads title, body and the issues linked in the Development panel, same repo or another repo of the owner.
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
  const refs = pr.closingIssuesReferences.nodes.filter((i) => i.repository.owner.login === repo.owner);
  const linked = refs.filter((i) => i.repository.name === repo.repo).map((i) => i.number);
  const otherRepos = refs
    .filter((i) => i.repository.name !== repo.repo)
    .map((i) => ({ repo: { owner: repo.owner, repo: i.repository.name }, number: i.number }));
  return { title: pr.title, body: pr.body ?? '', linked, otherRepos };
}

module.exports = { getPullRequest };
