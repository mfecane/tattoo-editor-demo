# GitHub Pages Deployment Guide

> **Note:** This guide is generic for GitHub Pages deployment. Update repository-specific values (URL, base path, branch names) to match your actual setup.

This guide explains how to deploy this application to GitHub Pages using GitHub Actions.

## Live Site

The application is deployed to GitHub Pages. Check `package.json` `homepage` field for the current live deployment URL.

Current repository: https://github.com/mfecane/tattoo-editor-demo/

## Prerequisites

- A GitHub repository for this project
- GitHub Actions enabled in your repository (enabled by default)

## Setup Steps

### 1. Configure Base Path

The `vite.config.ts` file includes a base path configuration for GitHub Pages. You need to update it to match your repository name:

1. Open `vite.config.ts`
2. Find the `base` property in the `defineConfig` object
3. Update it to match your deployment URL

For example, if your repository is `https://github.com/username/my-project`, update the base to:

```typescript
base: '/my-project/',
```

If you're deploying to a custom domain or the repository root, use:

```typescript
base: '/',
```

**Note:** The workflow automatically sets the base path using the `GITHUB_REPOSITORY` environment variable during the build, so you may not need to manually update it. However, for local development, ensure the base path matches your repository name.

### 2. Enable GitHub Pages

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select **"GitHub Actions"** (not "Deploy from a branch")
4. Save the settings

### 3. Push to Trigger Deployment

Once you've enabled GitHub Pages:

1. Commit and push the changes to your repository:
   ```bash
   git add .
   git commit -m "Add GitHub Pages deployment"
   git push origin master
   ```

2. The GitHub Actions workflow will automatically:
   - Build your application
   - Deploy it to GitHub Pages

3. Monitor the deployment:
   - Go to the **Actions** tab in your GitHub repository
   - You should see a workflow run called "Deploy to GitHub Pages"
   - Wait for it to complete (usually takes 1-2 minutes)

### 4. Access Your Deployed Site

After the first successful deployment, your site will be available at:

```
https://[username].github.io/[repository-name]/
```

For example, if your username is `johndoe` and repository is `editor`:
```
https://johndoe.github.io/editor/
```

## Manual Deployment

You can also trigger a manual deployment:

1. Go to the **Actions** tab in your GitHub repository
2. Select the "Deploy to GitHub Pages" workflow
3. Click **"Run workflow"**
4. Select the branch (usually `master` or `main`)
5. Click **"Run workflow"**

## Troubleshooting

### Build Fails

- Check the **Actions** tab for error messages
- Ensure all dependencies are listed in `package.json`
- Verify that `npm run build` works locally

### Site Shows 404

- Verify the base path in `vite.config.ts` matches your repository name
- Check that GitHub Pages is enabled and using "GitHub Actions" as the source
- Wait a few minutes after deployment - GitHub Pages can take time to propagate

### Assets Not Loading

- Ensure the base path is correctly configured
- Check browser console for 404 errors on assets
- Verify that all assets are in the `public` directory or properly imported

### Branch Name Mismatch

If your default branch is `main` instead of `master`:

1. Open `.github/workflows/deploy.yml`
2. Change `branches: - master` to `branches: - main`

## Local Testing

To test the production build locally before deploying:

```bash
npm run build
npm run preview
```

This will build the application and serve it locally, allowing you to verify that everything works correctly with the production configuration.

## Continuous Deployment

The workflow is configured to automatically deploy on every push to the `master` branch. If you want to deploy only on specific branches or tags, modify the `on.push.branches` section in `.github/workflows/deploy.yml`.
