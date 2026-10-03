// CI/CD pipeline: test, build, scan, push to ECR, deploy to the app server.
//
// The Jenkins server (created by Terraform) already has:
//   - Node.js, Docker and the AWS CLI installed
//   - an IAM role that can push to ECR and run commands on the app server (no keys needed)
//   - /var/lib/jenkins/cicd.env with ECR_REPO_URL, APP_INSTANCE_ID, APP_PRIVATE_IP, AWS_REGION

pipeline {
    agent any

    triggers {
        // Check GitHub for new commits every ~2 minutes
        pollSCM('H/2 * * * *')
    }

    options {
        timestamps()
        timeout(time: 25, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                script {
                    def scmVars = checkout scm
                    env.GIT_SHORT = scmVars.GIT_COMMIT.substring(0, 7)
                    env.GIT_BRANCH_NAME = scmVars.GIT_BRANCH ?: ''
                }
            }
        }

        stage('Prepare') {
            steps {
                script {
                    env.AWS_REGION = sh(script: '. /var/lib/jenkins/cicd.env && echo $AWS_REGION', returnStdout: true).trim()
                    env.AWS_DEFAULT_REGION = env.AWS_REGION
                    env.ECR_REPO_URL = sh(script: '. /var/lib/jenkins/cicd.env && echo $ECR_REPO_URL', returnStdout: true).trim()
                    env.APP_INSTANCE_ID = sh(script: '. /var/lib/jenkins/cicd.env && echo $APP_INSTANCE_ID', returnStdout: true).trim()
                    env.APP_PRIVATE_IP = sh(script: '. /var/lib/jenkins/cicd.env && echo $APP_PRIVATE_IP', returnStdout: true).trim()
                    env.IMAGE_URI = "${env.ECR_REPO_URL}:${env.BUILD_NUMBER}"
                }
                sh 'node --version && npm --version && docker --version && aws --version'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }

        stage('Test') {
            steps {
                sh 'npm run test:ci'
            }
            post {
                always {
                    junit 'test-results.xml'
                }
            }
        }

        stage('Docker Build') {
            steps {
                sh '''
                    docker build \
                      --build-arg BUILD_NUMBER=${BUILD_NUMBER} \
                      --build-arg GIT_COMMIT=${GIT_SHORT} \
                      --build-arg BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
                      -t ${IMAGE_URI} \
                      -t ${ECR_REPO_URL}:latest .
                '''
            }
        }

        stage('Security Scan (Trivy)') {
            steps {
                sh '''
                    # Report HIGH and CRITICAL findings (does not fail the build)
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      -v trivy-cache:/root/.cache \
                      aquasec/trivy:latest image \
                      --severity HIGH,CRITICAL --ignore-unfixed --exit-code 0 ${IMAGE_URI}

                    # Fail the build if a CRITICAL vulnerability with a fix exists
                    docker run --rm \
                      -v /var/run/docker.sock:/var/run/docker.sock \
                      -v trivy-cache:/root/.cache \
                      aquasec/trivy:latest image \
                      --severity CRITICAL --ignore-unfixed --exit-code 1 --quiet ${IMAGE_URI}
                '''
            }
        }

        stage('Push to ECR') {
            when {
                expression { env.GIT_BRANCH_NAME in ['origin/main', 'main'] }
            }
            steps {
                sh '''
                    aws ecr get-login-password --region ${AWS_REGION} \
                      | docker login --username AWS --password-stdin ${ECR_REPO_URL%%/*}
                    docker push ${IMAGE_URI}
                    docker push ${ECR_REPO_URL}:latest
                '''
            }
        }

        stage('Deploy') {
            when {
                expression { env.GIT_BRANCH_NAME in ['origin/main', 'main'] }
            }
            steps {
                sh '''
                    set -e
                    # The app server may still be registering with Systems Manager right after creation
                    CMD_ID=""
                    for attempt in 1 2 3 4 5 6; do
                      CMD_ID=$(aws ssm send-command \
                        --instance-ids "${APP_INSTANCE_ID}" \
                        --document-name "AWS-RunShellScript" \
                        --comment "Deploy build ${BUILD_NUMBER}" \
                        --parameters "commands=[\\"/opt/cicd-app/deploy.sh ${IMAGE_URI}\\"]" \
                        --query "Command.CommandId" --output text) && break
                      echo "send-command failed (attempt ${attempt}), retrying in 20s"
                      sleep 20
                    done
                    [ -n "$CMD_ID" ] || { echo "Could not send the deploy command"; exit 1; }

                    STATUS="Pending"
                    for i in $(seq 1 60); do
                      STATUS=$(aws ssm get-command-invocation --command-id "$CMD_ID" \
                        --instance-id "${APP_INSTANCE_ID}" --query Status --output text 2>/dev/null || echo Pending)
                      case "$STATUS" in Pending|InProgress|Delayed) sleep 5 ;; *) break ;; esac
                    done

                    echo "---- Deploy output ----"
                    aws ssm get-command-invocation --command-id "$CMD_ID" \
                      --instance-id "${APP_INSTANCE_ID}" --query StandardOutputContent --output text
                    echo "---- Deploy errors ----"
                    aws ssm get-command-invocation --command-id "$CMD_ID" \
                      --instance-id "${APP_INSTANCE_ID}" --query StandardErrorContent --output text
                    echo "Deploy status: $STATUS"
                    [ "$STATUS" = "Success" ]
                '''
            }
        }

        stage('Verify Live Site') {
            when {
                expression { env.GIT_BRANCH_NAME in ['origin/main', 'main'] }
            }
            steps {
                sh '''
                    curl -fsS http://${APP_PRIVATE_IP}/api/version | tee version.json
                    grep -q "\\"build\\":\\"${BUILD_NUMBER}\\"" version.json
                    echo
                    echo "Build ${BUILD_NUMBER} is live."
                '''
            }
        }
    }

    post {
        success {
            echo 'CI/CD pipeline PASSED'
        }
        failure {
            echo 'CI/CD pipeline FAILED. Check the stage logs above.'
        }
        cleanup {
            sh 'docker image prune -f --filter "until=48h" || true'
            cleanWs()
        }
    }
}
