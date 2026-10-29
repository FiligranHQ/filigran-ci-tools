'use strict';

const { findIssues, skipManualClose, decide } = require('./logic');
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

  let targets;
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
    targets = [{ repo, number: issue.number }];
  } else {
    const prNumber = Number(env.PR_NUMBER_INPUT || context.payload.pull_request.number);
    const pr = await pullRequests.getPullRequest(github, repo, prNumber);
    targets = [...findIssues({ prNumber, ...pr }).map((i) => ({ repo, ...i })), ...pr.otherRepos];
  }
  const label = (t) => (t.repo.repo === repo.repo ? `#${t.number}` : `${t.repo.repo}#${t.number}`);
  core.info(`Detected issues: ${targets.map(label).join(' ') || '<none>'}`);
  if (targets.length === 0) return;

  const field = await projects.getStatusField(github, project);
  const failed = [];

  for (const target of targets) {
    const { repo: issueRepo, number } = target;
    const ref = label(target);
    try {
      const issue = await issues.getIssue(github, issueRepo, number);
      if (!issue) {
        core.warning(`${ref} is not an issue of ${issueRepo.owner}/${issueRepo.repo} — skipping.`);
        continue;
      }
      const item = await projects.getIssueItem(github, issueRepo, number, project);
      if (!item) {
        core.info(`Issue ${ref} is not in project ${project.owner}/#${project.number} — skipping.`);
        continue;
      }

      const hasFeatureFlag = issue.labels.includes(env.FF_LABEL);
      core.info(`Issue ${ref}: status "${item.status}", feature-flag ${hasFeatureFlag}, milestone "${issue.milestone ?? ''}"`);
      const decision = decide({
        hasFeatureFlag,
        status: item.status,
        event: context.eventName,
        milestone: issue.milestone,
        targetMilestone: env.TARGET_MILESTONE,
        fallbackStatus: env.FALLBACK_STATUS,
        canClose: target.canClose,
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
        await issues.comment(github, issueRepo, number, noTestComment);
        core.info('✅ "not tested" comment added.');
      }
      if (decision.close) {
        await issues.addLabel(github, issueRepo, number, 'solved');
        if (issue.state !== 'CLOSED') await issues.closeIssue(github, issueRepo, number);
        core.info('✅ Closed with "solved".');
      }
      if (decision.milestone) {
        const milestone = await milestones.findMilestone(github, issueRepo, env.TARGET_MILESTONE);
        if (milestone) {
          await milestones.setMilestone(github, issueRepo, number, milestone.number);
          core.info(`✅ Milestone → "${env.TARGET_MILESTONE}"`);
        } else {
          core.warning(`Milestone "${env.TARGET_MILESTONE}" not found — skipping.`);
        }
      }
    } catch (err) {
      core.error(`Issue ${ref}: ${err.message}`);
      failed.push(ref);
    }
  }

  if (failed.length > 0) core.setFailed(`Could not sync: ${failed.join(', ')}`);
}

module.exports = { run };
