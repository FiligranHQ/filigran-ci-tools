'use strict';

const TITLE_REF = /\((#\d+(?:,\s*#\d+)*)\)\s*$/;
const KEYWORD_REF = /\b(?:close[sd]?|fix(?:es|ed)?|resolve[sd]?)\s*:?\s*#(\d+)/gi;
const FPV = 'Final product validation';

// Issue numbers in the "(#n)" or "(#n, #m)" at the end of the title.
function findIssueNumbersInTitle(title = '') {
  const ref = title.match(TITLE_REF);
  return ref ? [...ref[1].matchAll(/#(\d+)/g)].map((m) => Number(m[1])) : [];
}

// Issue numbers after a closing keyword (Closes, Fixes, Resolves…) in the body.
function findIssueNumbersInBody(body = '') {
  return [...body.matchAll(KEYWORD_REF)].map((m) => Number(m[1]));
}

// Issues of a PR, minus the PR itself. Only a closing keyword or the Development panel may close one.
function findIssues({ prNumber, title, body, linked = [] }) {
  const closing = new Set([...findIssueNumbersInBody(body), ...linked]);
  const numbers = new Set([...findIssueNumbersInTitle(title), ...closing]);
  numbers.delete(prNumber);
  return [...numbers].sort((a, b) => a - b).map((number) => ({ number, canClose: closing.has(number) }));
}

// Why a manual close is ignored, or null when it must be synced.
function skipManualClose({ number, stateReason, senderType, closer }) {
  if (stateReason !== 'completed') return `Issue #${number} closed as "${stateReason}" — skipping.`;
  if (senderType === 'Bot') return `Issue #${number} closed by a bot — skipping.`;
  if (closer === 'PullRequest') return `Issue #${number} closed by a pull request — handled by the merge run.`;
  return null;
}

// The rule matching the issue, or null when none does. A null status keeps the current one.
function findRule({ hasFeatureFlag, status, event, fallbackStatus }) {
  if (hasFeatureFlag) {
    if (status === 'In review' && event !== 'issues') return { status: 'Test PO main-ff', close: false };
    if (status === 'Ready to remove FF') return { status: FPV, close: true };
    return null;
  }
  if (status === 'Ready to merge') return { status: FPV, close: true };
  if (status === 'In review') return { status: 'Done', close: true, comment: true };
  if (status?.includes('main-ff')) return null;
  if (status === 'Done' || status === FPV) return { status: null, close: true };
  return { status: fallbackStatus, close: true };
}

// What to do with an issue, or { skip: reason } when there is nothing to do.
function decide({ hasFeatureFlag, status, event, milestone, targetMilestone, fallbackStatus, canClose = true }) {
  const rule = findRule({ hasFeatureFlag, status, event, fallbackStatus });
  if (!rule) return { skip: `No rule for status "${status}" with feature-flag=${hasFeatureFlag} — nothing to do.` };
  if (rule.close && !canClose) return { skip: 'Only cited in the PR title — not closed.' };

  const keepMilestone = milestone?.startsWith('Release') || milestone === targetMilestone;
  return {
    status: rule.status,
    close: rule.close,
    comment: rule.comment ?? false,
    milestone: rule.close && !keepMilestone,
  };
}

module.exports = { findIssues, skipManualClose, decide };
