/**
 * Fetches an issue from GitHub.
 *
 * @param {object} github - Octokit instance
 * @param {{ owner: string, repo: string }} repo
 * @param {number} issueNumber
 * @returns {Promise<object>} GitHub issue object
 */
async function getIssue(github, repo, issueNumber) {
  const { data } = await github.rest.issues.get({
    owner: repo.owner,
    repo: repo.repo,
    issue_number: issueNumber,
  });
  return data;
}

/**
 * Finds an existing milestone by title (open or closed),
 * or creates it if it doesn't exist.
 *
 * @param {object} github - Octokit instance
 * @param {{ owner: string, repo: string }} repo
 * @param {string} title - Milestone title
 * @returns {Promise<object>} GitHub milestone object
 */
async function findOrCreateMilestone(github, repo, title) {
  // Search open milestones first
  for (const state of ['open', 'closed']) {
    const { data: milestones } = await github.rest.issues.listMilestones({
      owner: repo.owner,
      repo: repo.repo,
      state,
      per_page: 100,
    });
    const found = milestones.find((m) => m.title === title);
    if (found) return found;
  }

  // Not found — create it
  const { data: created } = await github.rest.issues.createMilestone({
    owner: repo.owner,
    repo: repo.repo,
    title,
  });
  return created;
}

/**
 * Sets the milestone on an issue.
 *
 * @param {object} github - Octokit instance
 * @param {{ owner: string, repo: string }} repo
 * @param {number} issueNumber
 * @param {number} milestoneNumber
 */
async function setIssueMilestone(github, repo, issueNumber, milestoneNumber) {
  await github.rest.issues.update({
    owner: repo.owner,
    repo: repo.repo,
    issue_number: issueNumber,
    milestone: milestoneNumber,
  });
}

module.exports = { getIssue, findOrCreateMilestone, setIssueMilestone };
