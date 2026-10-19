'use strict';

const { findIssueNumbers, skipManualClose, decide } = require('./logic');
const issues = require('../lib/issues');
const milestones = require('../lib/milestones');
const projects = require('../lib/projects');
const pullRequests = require('../lib/pull-requests');

// Syncs the issues of a merged PR, or the issue closed by hand.
async function run({ github, context, core }) {
  const env = process.env;
  const repo = context.repo;
  const project = { owner: env.PROJECT_OWNER, number: Number(env.PROJECT_NUMBER) };
  const noTestComment = '⚠️ This issue is moved directly to `Done` without a `feature-flag` label and without a dedicated test branch. We therefore assume that it **will not be tested** before going live.';

  let numbers;
  if (context.eventName === 'issues') {
    const issue = context.payload.issue;
    const reason = skipManualClose({
      number: issue.number,
      stateReason: issue.state_reason,
      senderType: context.payload.sender.type,
      closer: await issues.getCloser(github, repo, issue.number),
    });
    if (reason) {
      core.info(reason);
      return;
    }
    numbers = [issue.number];
  } else {
    const prNumber = Number(env.PR_NUMBER_INPUT || context.payload.pull_request.number);
    const pr = await pullRequests.getPullRequest(github, repo, prNumber);
    numbers = findIssueNumbers({ prNumber, ...pr });
  }
  core.info(`Detected issues: ${numbers.join(' ') || '<none>'}`);
  if (numbers.length === 0) return;

  const field = await projects.getStatusField(github, project);
  const failed = [];

  for (const number of numbers) {
    try {
      const issue = await issues.getIssue(github, repo, number);
      if (!issue) {
        core.warning(`#${number} is not an issue of ${repo.owner}/${repo.repo} — skipping.`);
        continue;
      }
      const item = await projects.getIssueItem(github, repo, number, project);
      if (!item) {
        core.info(`Issue #${number} is not in project ${project.owner}/#${project.number} — skipping.`);
        continue;
      }

      const hasFeatureFlag = issue.labels.includes(env.FF_LABEL);
      core.info(`Issue #${number}: status "${item.status}", feature-flag ${hasFeatureFlag}, milestone "${issue.milestone ?? ''}"`);
      const decision = decide({
        hasFeatureFlag,
        status: item.status,
        event: context.eventName,
        milestone: issue.milestone,
        targetMilestone: env.TARGET_MILESTONE,
        fallbackStatus: env.FALLBACK_STATUS,
      });
      if (decision.skip) {
        core.info(decision.skip);
        continue;
      }

      if (decision.status) {
        await projects.setStatus(github, field, item.id, decision.status);
        core.info(`✅ Status → "${decision.status}"`);
      }
      if (decision.comment) {
        await issues.comment(github, repo, number, noTestComment);
        core.info('✅ "not tested" comment added.');
      }
      if (decision.close) {
        await issues.addLabel(github, repo, number, 'solved');
        if (issue.state !== 'CLOSED') await issues.closeIssue(github, repo, number);
        core.info('✅ Closed with "solved".');
      }
      if (decision.milestone) {
        const milestone = await milestones.findMilestone(github, repo, env.TARGET_MILESTONE);
        if (milestone) {
          await milestones.setMilestone(github, repo, number, milestone.number);
          core.info(`✅ Milestone → "${env.TARGET_MILESTONE}"`);
        } else {
          core.warning(`Milestone "${env.TARGET_MILESTONE}" not found — skipping.`);
        }
      }
    } catch (err) {
      core.error(`Issue #${number}: ${err.message}`);
      failed.push(number);
    }
  }

  if (failed.length > 0) core.setFailed(`Could not sync: #${failed.join(', #')}`);
}

module.exports = { run };
