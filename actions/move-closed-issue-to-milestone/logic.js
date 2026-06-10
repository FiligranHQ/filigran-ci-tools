'use strict';

/**
 * Decides whether a closed issue should be moved to the target milestone.
 *
 * Only issues that have at least one of the source labels are moved.
 *
 * @param {object} params
 * @param {string[]} params.sourceLabels - List of labels to match
 * @param {string} params.targetMilestone - Milestone to move the issue to
 * @param {{number: number, labels: string[]} | null} params.issue
 */
function decide({ sourceLabels, targetMilestone, issue }) {
  if (!issue) {
    return { action: 'skip', reason: 'No issue provided' };
  }
  const issueLabels = issue.labels || [];
  const hasMatchingLabel = issueLabels.some(label => sourceLabels.includes(label));
  if (!hasMatchingLabel) {
    return { action: 'skip', reason: `Issue #${issue.number} has no matching label from [${sourceLabels.join(', ')}], skipping` };
  }
  return { action: 'move', issueNumber: issue.number, targetMilestone };
}

module.exports = { decide };
