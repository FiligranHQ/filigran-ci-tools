'use strict';

// Finds a milestone by title, open or closed; null when missing.
async function findMilestone(github, repo, title) {
  const milestones = await github.paginate(github.rest.issues.listMilestones, { ...repo, state: 'all', per_page: 100 });
  return milestones.find((m) => m.title === title) ?? null;
}

// Sets the issue milestone.
async function setMilestone(github, repo, number, milestoneNumber) {
  await github.rest.issues.update({ ...repo, issue_number: number, milestone: milestoneNumber });
}

module.exports = { findMilestone, setMilestone };
