output "jenkins_url" {
  description = "Jenkins web UI (ready about 5 to 8 minutes after apply)."
  value       = "http://${aws_instance.jenkins.public_ip}:8080"
}

output "app_url" {
  description = "The deployed website (live after the first successful pipeline run)."
  value       = "http://${aws_instance.app.public_ip}"
}

output "ecr_repository_url" {
  description = "Container registry where Jenkins pushes images."
  value       = aws_ecr_repository.app.repository_url
}

output "app_instance_id" {
  description = "Instance ID of the app server."
  value       = aws_instance.app.id
}

output "ssh_jenkins" {
  description = "Command to log in to the Jenkins server."
  value       = "ssh -i <path-to-your-key>.pem ubuntu@${aws_instance.jenkins.public_ip}"
}

output "jenkins_admin_password_command" {
  description = "Run this after logging in over SSH to read the first-time Jenkins password."
  value       = "sudo cat /var/lib/jenkins/secrets/initialAdminPassword"
}
