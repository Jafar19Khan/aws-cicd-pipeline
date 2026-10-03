variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Prefix used for resource names and tags."
  type        = string
  default     = "cicd-demo"
}

variable "my_ip_cidr" {
  description = "Your public IP in CIDR form, for example 203.0.113.25/32. Only this address can reach SSH and the Jenkins UI."
  type        = string

  validation {
    condition     = can(cidrnetmask(var.my_ip_cidr))
    error_message = "my_ip_cidr must be a valid CIDR block such as 203.0.113.25/32."
  }
}

variable "key_name" {
  description = "Name of an existing EC2 key pair, used for SSH access to the servers."
  type        = string
}

variable "jenkins_instance_type" {
  description = "Instance type for the Jenkins server (2 GB of RAM or more is recommended)."
  type        = string
  default     = "t3.small"
}

variable "app_instance_type" {
  description = "Instance type for the app server."
  type        = string
  default     = "t3.micro"
}

variable "jenkins_volume_gb" {
  description = "Root disk size for the Jenkins server. Jenkins goes offline when free space gets low, so keep this at 20 or more."
  type        = number
  default     = 20
}

variable "app_volume_gb" {
  description = "Root disk size for the app server."
  type        = number
  default     = 10
}
