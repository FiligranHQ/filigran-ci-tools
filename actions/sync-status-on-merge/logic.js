'use strict';

const TITLE_REF = /\((#\d+(?:,\s*#\d+)*)\)\s*$/;
const KEYWORD_REF = /\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\s*:?\s*#(\d+)/gi;
const FINAL_STATUSES = ['Done', 'Final product validation'];

function findIssueNumbers({ prNumber, title = '', body = '', linked = [] }) {
  const numbers = new Set(linked);
  const titleRef = title.match(TITLE_REF);
  if (titleRef) {
    for (const m of titleRef[1].matchAll(/#(\d+)/g)) numbers.add(Number(m[1]));
  }
  for (const m of `${title}\n${body}`.matchAll(KEYWORD_REF)) numbers.add(Number(m[1]));
  numbers.delete(prNumber);
  return [...numbers].sort((a, b) => a - b);
}

function skipManualClose({ number, stateReason, senderType, closer }) {
  if (stateReason !== 'completed') return `Issue #${number} closed as "${stateReason}" — skipping.`;
  if (senderType === 'Bot') return `Issue #${number} closed by a bot — skipping.`;
  if (closer === 'PullRequest') return `Issue #${number} closed by a pull request — handled by the merge run.`;
  return null;
}

function decide({ hasFeatureFlag, status, event, milestone, targetMilestone, fallbackStatus }) {
  const skip = { action: 'skip', reason: `No rule for status "${status}" with feature-flag=${hasFeatureFlag} — nothing to do.` };
  const moveMilestone = !milestone?.startsWith('Release') && milestone !== targetMilestone;
  const close = (newStatus, extra = {}) => ({
    action: 'sync', status: newStatus, close: true, milestone: moveMilestone, comment: false, ...extra,
  });

  if (hasFeatureFlag) {
    if (status === 'In review' && event !== 'issues') {
      return { action: 'sync', status: 'Test PO main-ff', close: false, milestone: false, comment: false };
    }
    if (status === 'Ready to remove FF') return close('Final product validation');
    return skip;
  }
  if (status === 'Ready to merge') return close('Final product validation');
  if (status === 'In review') return close('Done', { comment: true });
  if (status?.includes('main-ff')) return skip;
  if (FINAL_STATUSES.includes(status)) return close(null);
  return close(fallbackStatus);
}

module.exports = { findIssueNumbers, skipManualClose, decide };
