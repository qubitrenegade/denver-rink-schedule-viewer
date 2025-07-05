# Branch Protection Rules

To ensure code quality and prevent errors from being merged, we recommend setting up the following branch protection rules in GitHub.

## Steps to Configure Branch Protection

1. Go to your GitHub repository's settings
2. Navigate to "Branches" in the left sidebar
3. Click on "Add rule" under "Branch protection rules"
4. Configure the following settings:

## Recommended Settings for `main` Branch

- **Branch name pattern**: `main`
- **Require a pull request before merging**: ✓
  - **Require approvals**: ✓
  - **Required number of approvals**: 1
- **Require status checks to pass before merging**: ✓
  - **Require branches to be up to date before merging**: ✓
  - **Status checks that are required**:
    - `required-checks`
- **Require conversation resolution before merging**: ✓
- **Do not allow bypassing the above settings**: ✓ (optional)

## Additional Development Branches (optional)

For development or staging branches, consider similar but less strict rules:

- **Branch name pattern**: `develop`
- **Require a pull request before merging**: ✓
  - **Required number of approvals**: 1
- **Require status checks to pass before merging**: ✓
  - **Status checks that are required**:
    - `required-checks`

## Automated Enforcement

These rules ensure that:
1. All code changes require a PR
2. All critical tests must pass
3. At least one reviewer must approve changes
4. All conversations must be resolved

This helps maintain code quality and prevents breaking changes from being merged into protected branches.
