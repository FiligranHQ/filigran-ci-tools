'use strict';

/**
 * Fetches an issue by number from the GitHub API.
 *
 * @param {object} github - Octokit instance
 * @param {object} repo - { owner, repo }
 * @param {number} issueNumber
 * @returns {Promise<object>} The issue data
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
 * Finds an open milestone by title, or creates it if it doesn't exist.
 *
 * @param {object} github - Octokit instance
 * @param {object} repo - { owner, repo }
 * @param {string} title - Milestone title
 * @returns {Promise<object>} The milestone object
 */
async function findOrCreateMilestone(github, repo, title) {
  const { data: milestones } = await github.rest.issues.listMilestones({
    owner: repo.owner,
    repo: repo.repo,
    state: 'all',
    per_page: 100,
  });

  let milestone = milestones.find(m => m.title === title);
  if (!milestone) {
    const { data: created } = await github.rest.issues.createMilestone({
      owner: repo.owner,
      repo: repo.repo,
      title,
    });
    milestone = created;
  }
  return milestone;
}

/**
 * Assigns a milestone to an issue.
 *
 * @param {object} github - Octokit instance
 * @param {object} repo - { owner, repo }
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
