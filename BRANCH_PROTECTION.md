# Branch Protection Rules Setup Guide

This guide provides step-by-step instructions for setting up branch protection rules in the Denver Rink Schedule Viewer repository to ensure code quality and prevent errors from being merged.

## Why Branch Protection?

Branch protection rules ensure that:
- All code changes require a pull request
- Critical tests must pass before merging
- At least one reviewer must approve changes
- All conversations must be resolved
- No direct pushes to protected branches

## Prerequisites

Before setting up branch protection, ensure you have:
- Admin access to the repository
- Working GitHub workflows (`.github/workflows/pr-checks.yml` and `.github/workflows/test.yml`)
- The `required-checks` job configured in PR checks workflow

## Step-by-Step Configuration

### 1. Access Repository Settings

1. Navigate to your GitHub repository
2. Click on the **Settings** tab
3. In the left sidebar, click on **Branches**

### 2. Create Branch Protection Rule

1. Under "Branch protection rules", click **Add rule**
2. In the "Branch name pattern" field, enter: `main`

### 3. Configure Required Settings

Enable the following settings for the `main` branch:

#### ✅ Require a pull request before merging
- **Check this box** to ensure all changes go through PR review
- **Require approvals**: ✅ Enable this
- **Required number of approvals**: Set to `1` (minimum)
- **Dismiss stale PR approvals when new commits are pushed**: ✅ Recommended
- **Require review from code owners**: ✅ Optional (if you have CODEOWNERS file)

#### ✅ Require status checks to pass before merging
- **Check this box** to require CI/CD checks
- **Require branches to be up to date before merging**: ✅ Enable this
- **Status checks that are required**: Add the following:
  - `required-checks` (from PR Checks workflow)
  - `full-test-suite` (optional, from PR Checks workflow)

#### ✅ Require conversation resolution before merging
- **Check this box** to ensure all PR comments are resolved

#### ✅ Require signed commits
- **Optional**: Enable if you want to enforce commit signing

#### ✅ Require linear history
- **Optional**: Enable to prevent merge commits

#### ✅ Do not allow bypassing the above settings
- **Recommended**: Check this to prevent admins from bypassing rules
- **Note**: You can leave this unchecked if you need admin override capability

### 4. Additional Optional Settings

#### Include administrators
- **Recommended**: Check this to apply rules to admin users too
- **Note**: This means even admins must follow the protection rules

#### Allow force pushes
- **NOT recommended**: Keep this unchecked for main branch
- **Reason**: Force pushes can overwrite history and break collaboration

#### Allow deletions
- **NOT recommended**: Keep this unchecked for main branch
- **Reason**: Prevents accidental deletion of the main branch

### 5. Save Configuration

1. Click **Create** to save the branch protection rule
2. You should see the rule listed under "Branch protection rules"

## Verification

After setting up the rules, verify they work by:

1. **Create a test branch**: `git checkout -b test-branch-protection`
2. **Make a small change**: Edit a file and commit
3. **Push the branch**: `git push origin test-branch-protection`
4. **Create a pull request**: Try to merge directly - it should be blocked
5. **Check status checks**: Ensure the `required-checks` job runs and must pass

## Status Checks Reference

The repository includes these status checks that should be required:

### From `.github/workflows/pr-checks.yml`:
- **required-checks**: Core job that must pass
  - Type checking with TypeScript
  - Critical test execution (timezone, utilities, shared modules)
  - Build verification
  - Timezone bug prevention check

### From `.github/workflows/test.yml`:
- **test**: Full test suite (runs on push to main)
- **timezone-tests**: Dedicated timezone conversion tests

## Troubleshooting

### Status Check Not Appearing
- Ensure the workflow has run at least once on a PR
- Check that the job name matches exactly: `required-checks`
- Verify the workflow is enabled in the repository

### Cannot Merge Despite Green Checks
- Ensure all required status checks are selected
- Check that conversations are resolved if that rule is enabled
- Verify the required number of approvals is met

### Admin Override Needed
- If "Do not allow bypassing the above settings" is enabled, you may need to temporarily disable it
- Only use admin override for emergency situations
- Re-enable protection rules after emergency fixes

## Best Practices

1. **Start with basic rules** then add more restrictions as needed
2. **Test thoroughly** with a test PR before enforcing on all contributors
3. **Document the rules** for your team members
4. **Review and update** rules periodically as your project evolves
5. **Use draft PRs** for work-in-progress that isn't ready for review

## Integration with Existing Workflows

This repository's workflows are already configured to work with branch protection:

- **PR Checks** (`.github/workflows/pr-checks.yml`) runs the `required-checks` job
- **Tests** (`.github/workflows/test.yml`) provides comprehensive test coverage
- **Deploy Pages** (`.github/workflows/deploy-pages.yml`) handles automatic deployment

The branch protection rules will integrate seamlessly with these existing workflows.

## Support

If you encounter issues with branch protection setup:
1. Check the GitHub documentation on branch protection rules
2. Verify your admin permissions on the repository
3. Ensure all required workflows are present and functional
4. Test with a small change in a test branch first

---

**Result**: With these branch protection rules in place, your main branch will be protected against direct pushes, require PR reviews, and ensure all critical tests pass before any code is merged.