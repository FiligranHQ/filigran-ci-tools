'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { findIssueNumbers, skipManualClose, decide } = require('./logic');

const base = { event: 'pull_request', milestone: null, targetMilestone: '0. Candidate', fallbackStatus: 'Final product validation' };
const sync = (status, extra = {}) => ({ action: 'sync', status, close: true, milestone: true, comment: false, ...extra });

describe('findIssueNumbers', () => {
  it('reads the title reference', () => {
    assert.deepEqual(findIssueNumbers({ prNumber: 10, title: 'fix(ui): thing (#1, #2)' }), [1, 2]);
  });

  it('reads closing keywords in the title and body', () => {
    assert.deepEqual(findIssueNumbers({ prNumber: 10, title: 'fix: thing', body: '* Closes #3\nFixes: #4\nRelated #5' }), [3, 4]);
  });

  it('adds issues linked in the Development panel', () => {
    assert.deepEqual(findIssueNumbers({ prNumber: 8309, title: 'fix(ee): harden the license window', linked: [8299] }), [8299]);
  });

  it('ignores the PR own number', () => {
    assert.deepEqual(findIssueNumbers({ prNumber: 8399, title: 'docs(home): refresh the home page (#8399)' }), []);
  });

  it('ignores a reference not at the end of the title', () => {
    assert.deepEqual(findIssueNumbers({ prNumber: 10, title: 'fix: follow-up of (#1) for the form' }), []);
  });
});

describe('skipManualClose', () => {
  const close = { number: 1, stateReason: 'completed', senderType: 'User', closer: null };

  it('handles a manual close', () => {
    assert.equal(skipManualClose(close), null);
  });

  it('skips not planned', () => {
    assert.match(skipManualClose({ ...close, stateReason: 'not_planned' }), /not_planned/);
  });

  it('skips a close by a bot', () => {
    assert.match(skipManualClose({ ...close, senderType: 'Bot' }), /bot/);
  });

  it('skips a close by a pull request', () => {
    assert.match(skipManualClose({ ...close, closer: 'PullRequest' }), /merge run/);
  });
});

describe('decide', () => {
  it('feature-flag + In review → Test PO main-ff, stays open', () => {
    assert.deepEqual(decide({ ...base, hasFeatureFlag: true, status: 'In review' }),
      { action: 'sync', status: 'Test PO main-ff', close: false, milestone: false, comment: false });
  });

  it('feature-flag + In review closed by hand → nothing', () => {
    assert.equal(decide({ ...base, event: 'issues', hasFeatureFlag: true, status: 'In review' }).action, 'skip');
  });

  it('feature-flag + Ready to remove FF → FPV', () => {
    assert.deepEqual(decide({ ...base, hasFeatureFlag: true, status: 'Ready to remove FF' }), sync('Final product validation'));
  });

  it('feature-flag + other status → nothing', () => {
    assert.equal(decide({ ...base, hasFeatureFlag: true, status: 'Final product validation' }).action, 'skip');
  });

  it('Ready to merge → FPV', () => {
    assert.deepEqual(decide({ ...base, hasFeatureFlag: false, status: 'Ready to merge' }), sync('Final product validation'));
  });

  it('In review → Done with the not tested comment', () => {
    assert.deepEqual(decide({ ...base, hasFeatureFlag: false, status: 'In review' }), sync('Done', { comment: true }));
  });

  it('Done or FPV → status kept', () => {
    assert.deepEqual(decide({ ...base, hasFeatureFlag: false, status: 'Done' }), sync(null));
    assert.deepEqual(decide({ ...base, hasFeatureFlag: false, status: 'Final product validation' }), sync(null));
  });

  it('other status → fallback status', () => {
    assert.deepEqual(decide({ ...base, hasFeatureFlag: false, status: 'Ready for dev' }), sync('Final product validation'));
    assert.deepEqual(decide({ ...base, hasFeatureFlag: false, status: null }), sync('Final product validation'));
  });

  it('main-ff status without the label → nothing', () => {
    assert.equal(decide({ ...base, hasFeatureFlag: false, status: 'Test PO main-ff' }).action, 'skip');
  });

  it('keeps a Release milestone', () => {
    assert.equal(decide({ ...base, hasFeatureFlag: false, status: 'Done', milestone: 'Release 3.261008' }).milestone, false);
  });

  it('does not set the milestone twice', () => {
    assert.equal(decide({ ...base, hasFeatureFlag: false, status: 'Done', milestone: '0. Candidate' }).milestone, false);
  });
});
