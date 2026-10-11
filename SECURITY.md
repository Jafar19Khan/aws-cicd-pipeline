# Security policy

## Supported version

Security fixes are applied to the current `main` branch. This repository is a learning/portfolio project and is not a managed production service.

## Reporting a vulnerability

Please do not publish credentials, access tokens, private keys, personal data, or a working exploit in a public issue. Contact the repository owner privately through GitHub's security reporting feature where available. Include the affected file, impact, and steps to reproduce.

## Deployment security checklist

- Use a dedicated, least-privilege AWS identity with MFA for Terraform operations.
- Never commit `terraform.tfvars`, Terraform state, credentials, `.pem` files, or environment files.
- Restrict the Jenkins UI to a trusted IP/VPN and place it behind TLS before using it beyond a temporary demo.
- Configure HTTPS for the public application before collecting sensitive information.
- Review Trivy findings and keep base images and GitHub Actions updated.
- Rotate exposed credentials immediately; deleting a file from a later commit does not remove it from Git history.
