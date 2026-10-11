# Safely update the existing GitHub repository

Repository: https://github.com/Jafar19Khan/aws-cicd-pipeline.git  
Branch: `main`

The project is already on GitHub. Do **not** create a new repository, run `git init`, or add another `origin` remote.

## Recommended workflow on Windows PowerShell

1. Keep your current clone and make sure you are on the expected branch:

   ```powershell
   cd "C:\path\to\your\aws-cicd-pipeline"
   git remote -v
   git status
   git switch main
   git pull --ff-only origin main
   ```

2. Extract the updated ZIP to a temporary folder. Copy the updated project files into your existing clone, but do **not** copy a `.git` directory over the existing `.git` directory. If you use File Explorer, enable hidden items and make sure `.git` from the ZIP is not copied. The supplied update ZIP intentionally omits `.git`.

3. Review what changed before committing:

   ```powershell
   git status --short
   git diff --check
   git diff --stat
   git diff
   ```

4. Run local checks with Node.js 22:

   ```powershell
   npm run lint
   npm test
   docker build -t aws-cicd-pipeline:local .
   ```

5. Commit and push to the same GitHub repository:

   ```powershell
   git add -A
   git commit -m "Harden AWS CI/CD pipeline and documentation"
   git push origin main
   ```

If `git pull --ff-only` reports that the local branch has diverged, stop and inspect `git status`/`git log --oneline --graph --decorate -10`; do not force-push. If branch protection requires a pull request, push a feature branch and open a PR instead.

## AWS safety

The ZIP does not run Terraform and does not change any AWS resources by itself. After copying the files, run Terraform formatting/validation and review `terraform plan` before any `apply`. Do not run `terraform destroy` as part of updating the code.
