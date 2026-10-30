'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { findIssues, skipManualClose, decide } = require('./logic');

describe('findIssues', () => {
  it('reads the title, the closing keywords and the Development panel', () => {
    const pr = { prNumber: 10, title: 'fix: thing (#1, #2)', body: 'Closes #2\nFixes #3\nRelated #4', linked: [5] };
    assert.deepEqual(findIssues(pr), [
      { number: 1, canClose: false },
      { number: 2, canClose: true },
      { number: 3, canClose: true },
      { number: 5, canClose: true },
    ]);
  });

  it('ignores the PR own number', () => {
    assert.deepEqual(findIssues({ prNumber: 8399, title: 'docs(home): refresh the home page (#8399)', body: '' }), []);
  });
});

describe('skipManualClose', () => {
  it('only handles an issue closed as completed by a user', () => {
    const close = { number: 1, stateReason: 'completed', senderType: 'User', closer: null };
    assert.equal(skipManualClose(close), null);
    assert.ok(skipManualClose({ ...close, stateReason: 'not_planned' }));
    assert.ok(skipManualClose({ ...close, senderType: 'Bot' }));
    assert.ok(skipManualClose({ ...close, closer: 'PullRequest' }));
  });
});

describe('decide', () => {
  const FPV = 'Final product validation';
  const closed = (status, comment = false) => ({ status, close: true, comment, milestone: true });
  const skip = 'skip';
  const cases = [
    [true, 'In review', 'pull_request', { status: 'Test PO main-ff', close: false, comment: false, milestone: false }],
    [true, 'In review', 'issues', skip],
    [true, 'Ready to remove FF', 'pull_request', closed(FPV)],
    [true, FPV, 'pull_request', skip],
    [false, 'Ready to merge', 'pull_request', closed(FPV)],
    [false, 'In review', 'pull_request', closed('Done', true)],
    [false, 'Test PO main-ff', 'pull_request', skip],
    [false, 'Done', 'pull_request', closed(null)],
    [false, 'Ready for dev', 'issues', closed(FPV)],
  ];

  for (const [hasFeatureFlag, status, event, expected] of cases) {
    it(`feature-flag=${hasFeatureFlag}, ${status}, ${event}`, () => {
      const decision = decide({ hasFeatureFlag, status, event, milestone: null, targetMilestone: '0. Candidate', fallbackStatus: FPV });
      if (expected === skip) assert.ok(decision.skip);
      else assert.deepEqual(decision, expected);
    });
  }

  it('never closes an issue only cited in the title', () => {
    const base = { hasFeatureFlag: false, event: 'pull_request', milestone: null, targetMilestone: '0. Candidate', fallbackStatus: FPV, canClose: false };
    assert.ok(decide({ ...base, status: 'In progress' }).skip);
    assert.ok(decide({ ...base, status: 'Ready to merge' }).skip);
    assert.equal(decide({ ...base, hasFeatureFlag: true, status: 'In review' }).status, 'Test PO main-ff');
  });

  it('keeps a Release milestone', () => {
    const decision = decide({ hasFeatureFlag: false, status: 'Done', milestone: 'Release 3.261008', targetMilestone: '0. Candidate', fallbackStatus: FPV });
    assert.equal(decision.milestone, false);
  });
});
