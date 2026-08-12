# Development Workflow Rules for AdAgencyHub

Every task or feature modification in this project MUST strictly adhere to the following 4-step execution pipeline:

1. **Step 1: Pull from GitHub (`git pull origin main`)**
   - Before making any code changes or inspecting state, run `git pull origin main` to ensure local workspace has the latest remote updates.

2. **Step 2: Implement Changes**
   - Perform the required coding tasks, bug fixes, or enhancements.
   - Verify code correctness with `npm test` and `npm run typecheck`.

3. **Step 3: Deploy to Cloudflare (`npx wrangler deploy`)**
   - Build assets (`npm run build`) and deploy immediately to Cloudflare Workers, Pages, D1, and R2 using `npx wrangler deploy`.

4. **Step 4: Push to GitHub (`git push origin main`)**
   - Stage all modified files (`git add .`).
   - Create a clear commit message detailing the changes (`git commit -m "..."`).
   - Push updates back to remote (`git push origin main`).
