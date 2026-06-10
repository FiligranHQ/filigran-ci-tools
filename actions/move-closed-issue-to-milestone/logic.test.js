'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { decide } = require('./logic');

const SOURCE_LABELS = ['bug', 'critical'];
const TARGET = '0. Candidate';

describe('move-closed-issue-to-milestone', () => {
  it('skips when no issue', () => {
    assert.equal(decide({ sourceLabels: SOURCE_LABELS, targetMilestone: TARGET, issue: null }).action, 'skip');
  });

  it('skips when issue has no matching label', () => {
    const r = decide({ sourceLabels: SOURCE_LABELS, targetMilestone: TARGET, issue: { number: 1, labels: ['enhancement'] } });
    assert.equal(r.action, 'skip');
    assert.match(r.reason, /no matching label/);
  });

  it('skips when issue has no labels', () => {
    const r = decide({ sourceLabels: SOURCE_LABELS, targetMilestone: TARGET, issue: { number: 1, labels: [] } });
    assert.equal(r.action, 'skip');
  });

  it('moves when issue has the first source label', () => {
    const r = decide({ sourceLabels: SOURCE_LABELS, targetMilestone: TARGET, issue: { number: 42, labels: ['bug'] } });
    assert.deepEqual(r, { action: 'move', issueNumber: 42, targetMilestone: '0. Candidate' });
  });

  it('moves when issue has the second source label', () => {
    const r = decide({ sourceLabels: SOURCE_LABELS, targetMilestone: TARGET, issue: { number: 10, labels: ['critical', 'wontfix'] } });
    assert.deepEqual(r, { action: 'move', issueNumber: 10, targetMilestone: '0. Candidate' });
  });
});
