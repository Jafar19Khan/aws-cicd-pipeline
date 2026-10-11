# Contributing

1. Create a branch from `main`.
2. Use Node.js 22 and run `npm run lint` and `npm test`.
3. If infrastructure changes, run `terraform fmt -recursive`, `terraform init -backend=false`, and `terraform validate` in `terraform/` where Terraform is installed.
4. Review `terraform plan` before any apply. Do not commit state, credentials, `.pem` files, or `terraform.tfvars`.
5. Open a pull request. GitHub Actions runs lint, tests, and a container build. AWS deployment is performed by the separately configured Jenkins pipeline on `main`.

Keep changes small and update README or setup instructions when behavior changes.
