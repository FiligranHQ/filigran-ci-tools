/**
 * Decides whether to move an issue to the target milestone.
 *
 * @param {object} params
 * @param {string[]} params.sourceLabels - Labels that trigger the move
 * @param {string}   params.targetMilestone - Name of the target milestone
 * @param {object}   params.issue - Issue object { number, labels[] }
 * @returns {{ action: 'skip'|'move', issueNumber?: number, reason?: string }}
 */
function decide({ sourceLabels, targetMilestone, issue }) {
  const issueLabels = (issue.labels || []).map((l) => l.name ?? l);

  const hasMatchingLabel = sourceLabels.some((label) => issueLabels.includes(label));

  if (!hasMatchingLabel) {
    return {
      action: 'skip',
      reason: `Issue #${issue.number} has none of the source labels [${sourceLabels.join(', ')}] — skipping.`,
    };
  }

  if (issue.milestone && issue.milestone.title === targetMilestone) {
    return {
      action: 'skip',
      reason: `Issue #${issue.number} is already in milestone "${targetMilestone}" — skipping.`,
    };
  }

  return {
    action: 'move',
    issueNumber: issue.number,
  };
}

module.exports = { decide };
