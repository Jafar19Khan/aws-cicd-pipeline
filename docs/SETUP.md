# Setup guide

This guide takes you from nothing to a live website deployed by Jenkins.
Time needed: about 45 minutes, most of it waiting for servers to start.

## 1. What you need

- An AWS account and a **non-root IAM user** with programmatic access (enable MFA on the account)
- A GitHub account and Git
- Terraform 1.5 or newer: https://developer.hashicorp.com/terraform/install
- The AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
- Node.js 22.x (only to run the project on your laptop)

Check the installs:

```bash
terraform -version
aws --version
git --version
```

## 2. Connect the AWS CLI to your account

```bash
aws configure
```

Enter the IAM user's access key, secret key, region (for example `ap-south-1`) and
output format `json`. Check it works:

```bash
aws sts get-caller-identity
```

Keep these keys out of Git and out of screenshots.

## 3. Create an EC2 key pair

AWS Console -> EC2 -> Key Pairs -> **Create key pair**. Pick a name (for example
`cicd-key`), type RSA, format `.pem`, and save the downloaded file somewhere safe.
You will use the name in the next step.

## 4. Use the existing GitHub repository

This project is already associated with `https://github.com/Jafar19Khan/aws-cicd-pipeline`. If you are updating an existing local clone, do not run `git init` or add a second remote. First pull the latest `main` branch and review the changes you intend to commit. See [`UPDATE_EXISTING_GITHUB_REPO.md`](../UPDATE_EXISTING_GITHUB_REPO.md) for the safe update procedure.

If you are setting it up on a new machine, clone the repository:

```bash
git clone https://github.com/Jafar19Khan/aws-cicd-pipeline.git
cd aws-cicd-pipeline
```

GitHub Actions runs lint, tests, and a Docker build on pushes and pull requests. AWS deployment is performed by the Jenkins pipeline after it is configured.

## 5. Create the infrastructure

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:

- `my_ip_cidr`: your public IP followed by `/32` (search "what is my IP")
- `key_name`: the key pair name from step 3

Then:

```bash
terraform init
terraform plan
terraform apply
```

Type `yes` when asked. Terraform prints `jenkins_url`, `app_url` and an SSH command.

**Wait 5 to 8 minutes.** The servers install their software on first boot.

## 6. Unlock Jenkins

Log in to the Jenkins server with the `ssh_jenkins` command from the output
(on Windows, run `icacls` on the `.pem` file first if SSH complains about permissions):

```bash
tail -n 3 /var/log/user-data.log        # should end with "Bootstrap complete"
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

Open `jenkins_url` in your browser, paste the password, choose **Install suggested
plugins**, and create your admin user. Jenkins is exposed over HTTP in this demo; keep its security-group allowlist restricted to your trusted IP and do not reuse a weak password.

## 7. Create the pipeline job

1. **New Item**, name `aws-cicd-pipeline`, type **Pipeline**
2. **Pipeline** section: Definition **Pipeline script from SCM**, SCM **Git**
3. Repository URL: your GitHub repository URL
4. Branch Specifier: `*/main`, Script Path: `Jenkinsfile`
5. **Save**, then **Build Now**

Polling is set inside the `Jenkinsfile`, so later pushes start builds on their own
(within about 2 minutes, once the first build has run).

### What the first build does

It runs all stages. The first Trivy scan downloads its vulnerability database, so it takes
longer. If the Deploy stage reports `InvalidInstanceId`, the app server is still
registering with Systems Manager: wait a few minutes and run **Build Now** again.

When the build is green, open `app_url`. You should see the website, with the build number
in the "How this page got here" panel.

## 8. See the pipeline work

1. Edit the headline in `public/index.html`, commit and push.
2. Wait for Jenkins to start a build (up to 2 minutes), then watch the stages.
3. Refresh the website. The headline and the build number have changed.

Then try the rollback demo from the README.

## 9. Take screenshots for your portfolio

Before cleaning up, capture the Jenkins stage view (including a failed build), the live
website, and the ECR repository page. Add them to the README.

## 10. Clean up

```bash
cd terraform
terraform destroy
```

Type `yes`. This deletes both servers, disks, the registry, roles and security groups.
Afterwards, check the EC2, ECR, and VPC consoles for leftovers and review AWS Billing. Terraform destroy only removes resources tracked in the current Terraform state; it does not remove unrelated resources or resources created manually.

## Common mistakes

- Using `curl` in Windows PowerShell for API tests: use `Invoke-RestMethod` or `curl.exe`.
- Forgetting that your IP can change: Jenkins and SSH stop responding until you update `my_ip_cidr`.
- Leaving the servers running after the demo: run `terraform destroy`.

## Production hardening before real use

This is a portfolio/demo deployment, not a production service. Before real traffic or sensitive data: configure HTTPS (for example ALB + ACM + DNS), application authentication/authorization, backups and recovery tests, centralized logs/alarms, remote Terraform state with locking, reviewed least-privilege policies, and a patching/rotation process. The app stores data in a JSON file on the EC2 instance; that is not a substitute for a managed database and tested backups.
