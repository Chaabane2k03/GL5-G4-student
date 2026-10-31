// =====================================================================
//  Unified CI/CD pipeline for the whole monorepo (backend + frontend)
//
//  Backend services : api-gateway, course-service, department-service,
//                     enrollment-service, student-service
//  Frontend         : frontend-service (Angular)
//
//  Backend flow (per service, parallel and independent):
//    Version -> Build & Test -> [ SonarQube || Docker build ] -> Quality Gate -> Publish to Nexus (Maven)
//
//  Frontend flow:
//    Version -> Install -> Lint -> Test & Coverage -> Build -> SonarQube -> Quality Gate
//             -> Docker Build -> Smoke Test
//             -> Publish dist archive to Nexus (raw repo, release/snapshot like the backend)
//
//  Only components whose files changed are built (or all, via BUILD_ALL / Jenkinsfile change).
//
//  Optional AWS flow (develop/main only, DEPLOY_AWS=true):
//    Build all six images -> push to ECR -> Terraform apply -> ALB hostname
//    -> wait for rollouts (phases 1 to 4.2 of deploy/terraform/README.md).
// =====================================================================

// Single source of truth: add a new backend service here and it is picked up automatically.
def SERVICES = [
    'api-gateway'       : 'API Gateway',
    'course-service'    : 'Course Service',
    'department-service': 'Department Service',
    'enrollment-service': 'Enrollment Service',
    'student-service'   : 'Student Service'
]

// Frontend folder (built with npm, not Maven).
def FRONTEND = 'frontend-service'

// Changes here rebuild EVERYTHING (backend + frontend).
def GLOBAL_PATHS  = ['Jenkinsfile']
// Changes here rebuild every BACKEND service only.
def BACKEND_PATHS = ['pom.xml', 'common/', 'shared/']

pipeline {
    agent any

    tools {
        jdk 'JDK17'
        maven 'Maven3'
    }

    options {
        timestamps()
        disableConcurrentBuilds(abortPrevious: true)   // newer commit cancels older build
        buildDiscarder(logRotator(numToKeepStr: '20', artifactNumToKeepStr: '5'))
        // AWS deploys add 15-25 min (EKS + RDS + Helm) on top of the full build.
        timeout(time: 120, unit: 'MINUTES')
    }

    environment {
        NOTIFY_EMAIL     = 'chaabaneboussadia@gmail.com'
        RELEASE_BRANCH   = 'main'
        AWS_DEPLOY_BRANCHES = 'feature/aws-deployment,develop,main'
        DEFAULT_VERSION_PREFIX = '1.0'   // all components publish as 1.0.<build number>
        // MAVEN_OPTS (shared local repo) is already set by docker-compose.jenkins.yml
        // AWS_* credentials are injected by jenkins-nexus-docker/docker-compose.jenkins.yml
    }

    parameters {
        // ---- common ----
        booleanParam(name: 'BUILD_ALL', defaultValue: false,
            description: 'Build every component (backend + frontend), ignoring change detection')
        string(name: 'ONLY_SERVICES', defaultValue: '',
            description: 'Optional comma-separated list of components to build (e.g. api-gateway,student-service,frontend-service)')
        choice(name: 'MAX_PARALLEL_SERVICES', choices: ['1', '2', '3'],
            description: 'Maximum number of components built concurrently. Use 1 on memory-constrained Docker hosts.')
        booleanParam(name: 'ENFORCE_QUALITY_GATE', defaultValue: true,
            description: 'Fail a component if its SonarQube quality gate fails')
        booleanParam(name: 'DOCKER_BUILD', defaultValue: true,
            description: 'Build Docker images for selected backend services; the frontend image is built when selected')

        // ---- AWS / Terraform deployment (deploy/terraform, phases 1 to 4.2) ----
        booleanParam(name: 'DEPLOY_AWS', defaultValue: false,
            description: 'Deploy the full stack to AWS: build/push all six images to ECR, terraform apply, wait for the ALB and the rollouts. Only honoured on the develop and main branches.')
        string(name: 'AWS_REGION', defaultValue: 'us-east-1',
            description: 'AWS region used by Terraform, ECR and EKS')
        string(name: 'AWS_CLUSTER_NAME', defaultValue: 'gl5-g4',
            description: 'EKS cluster name (must match cluster_name in deploy/terraform)')
        string(name: 'TF_STATE_DIR', defaultValue: '/var/jenkins_home/aws-terraform',
            description: 'Persistent directory (outside the wiped workspace) holding terraform.tfstate, the ALB hostname and the provider cache')

        // ---- release / versioning (backend + frontend) ----
        booleanParam(name: 'FORCE_RELEASE', defaultValue: false,
            description: 'Force release deployment to Nexus regardless of git branch')
        string(name: 'OVERRIDE_VERSION', defaultValue: '',
            description: 'Optional manual version override for all components (e.g. 1.2.0)')

        // ---- frontend ----
        string(name: 'FRONTEND_IMAGE_NAME', defaultValue: 'frontend-service',
            description: 'Frontend Docker image repository name')
        string(name: 'FRONTEND_SONAR_HOST_URL', defaultValue: 'http://host.docker.internal:9000',
            description: 'SonarQube URL as seen from this controller (used by the frontend scanner)')
        string(name: 'SMOKE_HOST', defaultValue: 'host.docker.internal',
            description: 'Host used to reach the frontend smoke container')
        string(name: 'SMOKE_PORT', defaultValue: '4300',
            description: 'Host port for the frontend smoke container')
    }

    stages {

        stage('Checkout') {
            steps {
                deleteDir()
                checkout scm
            }
        }

        stage('Detect Changes') {
            steps {
                script {
                    env.IS_RELEASE = (isReleaseBuild() ? 'true' : 'false')

                    def deployRequested = params.DEPLOY_AWS
                    env.DEPLOY_AWS = (deployRequested && isAwsDeployBranch()) ? 'true' : 'false'
                    if (deployRequested && env.DEPLOY_AWS != 'true') {
                        echo "WARNING: DEPLOY_AWS ignored on branch '${currentBranch()}' (allowed: ${env.AWS_DEPLOY_BRANCHES})"
                    }
                    if (env.DEPLOY_AWS == 'true' && !params.DOCKER_BUILD) {
                        error 'DEPLOY_AWS requires DOCKER_BUILD=true: the six images must be built and pushed to ECR.'
                    }

                    def selected = selectServices(SERVICES.keySet() as List, FRONTEND,
                                                 GLOBAL_PATHS, BACKEND_PATHS)

                    // Terraform/Helm uses one image tag for every service, so a deploy
                    // must build and push the whole set, not only the changed services.
                    if (env.DEPLOY_AWS == 'true') {
                        selected = (SERVICES.keySet() as List) + [FRONTEND]
                        // Temporary: every deploy reuses the mutable `latest` tag. The
                        // images are still rebuilt and pushed, and phase 3 restarts the
                        // deployments so the nodes pull the new layers (pullPolicy=Always
                        // is set by Terraform for this tag). Switch back to
                        // "${env.BUILD_NUMBER}-<sha>" for immutable, reproducible tags.
                        env.DEPLOY_TAG = 'latest'
                        echo "AWS deploy: forcing all components, image tag ${env.DEPLOY_TAG}"
                    }

                    env.SELECTED_SERVICES = selected.join(',')
                    echo "Branch release mode : ${env.IS_RELEASE}"
                    echo "Components to build : ${env.SELECTED_SERVICES ?: '(none)'}"
                    currentBuild.description = env.SELECTED_SERVICES ?: 'no changes'
                }
            }
        }

        stage('Components') {
            when { expression { env.SELECTED_SERVICES } }
            steps {
                script {
                    def selected = env.SELECTED_SERVICES.split(',').findAll { it }
                    def limit = Math.max(1, (params.MAX_PARALLEL_SERVICES ?: '2').toInteger())
                    selected.collate(limit).eachWithIndex { batch, batchIndex ->
                        echo "Starting component batch ${batchIndex + 1}: ${batch.join(', ')}"
                        def branches = [:]
                    for (String svc : batch) {
                        def name = svc
                        if (name == FRONTEND) {
                            branches[name] = { runFrontend(name) }
                        } else {
                            def displayName = SERVICES[name]
                            branches[name] = { runService(name, displayName) }
                        }
                    }
                        branches.failFast = false
                        parallel branches
                    }
                }
            }
        }

        stage('Deploy to AWS') {
            when { expression { env.DEPLOY_AWS == 'true' } }
            steps {
                script {
                    deployToAws((SERVICES.keySet() as List) + [FRONTEND])
                }
            }
        }
    }

    post {
        always {
            script {
                def rows = (env.SELECTED_SERVICES ?: '').split(',').findAll { it }.collect { svc ->
                    "<tr><td>${svc}</td><td>${serviceResults[svc] ?: 'NOT RUN'}</td></tr>"
                }.join('')
                sendGridMail(
                    "${env.JOB_NAME} - Build #${env.BUILD_NUMBER} - ${currentBuild.currentResult}",
                    """
                        <h2>Jenkins Build Report</h2>
                        <p><b>Job:</b> ${env.JOB_NAME} &nbsp; <b>Build:</b> #${env.BUILD_NUMBER}
                           &nbsp; <b>Status:</b> ${currentBuild.currentResult}</p>
                        <p><b>Branch:</b> ${env.BRANCH_NAME ?: env.GIT_BRANCH} &nbsp;
                           <b>Mode:</b> ${env.IS_RELEASE == 'true' ? 'RELEASE' : 'SNAPSHOT'}</p>
                        <table border="1" cellpadding="6" cellspacing="0">
                          <tr><th>Component</th><th>Result</th></tr>
                          ${rows ?: '<tr><td colspan="2">Nothing built (no changes detected)</td></tr>'}
                        </table>
                        <p><a href="${env.BUILD_URL}">Build details</a> |
                           <a href="${env.BUILD_URL}console">Console output</a></p>
                    """
                )
            }
        }
        success { echo 'All selected components built successfully' }
        failure { echo 'One or more components failed' }
    }
}

// ---------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------

@groovy.transform.Field Map serviceResults = [:]

boolean isReleaseBuild() {
    return currentBranch() == env.RELEASE_BRANCH || params.FORCE_RELEASE
}

String currentBranch() {
    return (env.BRANCH_NAME ?: env.GIT_BRANCH ?: '').replaceFirst('^origin/', '')
}

boolean isAwsDeployBranch() {
    def allowed = (env.AWS_DEPLOY_BRANCHES ?: 'develop,main')
                      .split(',').collect { it.trim() }
    return allowed.contains(currentBranch())
}

List selectServices(List backends, String frontend,
                    List globalPaths, List backendPaths) {

    def all = backends + [frontend]

    // Explicit component selection has priority.
    if (params.ONLY_SERVICES?.trim()) {
        def wanted = params.ONLY_SERVICES.split(',')
                         .collect { it.trim() }

        return all.findAll { wanted.contains(it) }
    }

    // Build everything when requested.
    if (params.BUILD_ALL) {
        return all
    }

    def base = env.GIT_PREVIOUS_SUCCESSFUL_COMMIT ?:
               env.GIT_PREVIOUS_COMMIT

    if (!base) {
        echo 'No previous commit known -> building everything'
        return all
    }

    def changed = sh(
        script: "git diff --name-only ${base} HEAD || true",
        returnStdout: true
    ).trim().split('\n').findAll { it }

    echo "Changed files:"
    changed.each { echo " - ${it}" }

    // Jenkinsfile changed -> build everything.
    if (changed.any { f ->
        globalPaths.any { f.startsWith(it) }
    }) {
        echo 'Pipeline definition changed -> building everything'
        return all
    }

    // Detect modified backend services.
    def selected = backends.findAll { svc ->
        changed.any { it.startsWith("${svc}/") }
    }
    if (changed.any { it.startsWith("${frontend}/") }) {
        selected << frontend
    }

    // Shared backend files -> rebuild every backend.
    if (changed.any { f ->
        backendPaths.any { f.startsWith(it) }
    }) {
        echo 'Shared backend files changed -> building all backend services'
        selected = backends
    }

    return selected
}

// Loads optional, non-secret CI overrides (ci.env) inside the service folder.
String ciEnv() {
    return '[ -f ci.env ] && set -a && . ./ci.env && set +a || true'
}

// Shared by backend and frontend: 1.0.<build> for releases, 1.0.<build>-SNAPSHOT otherwise.
String resolveVersion() {
    if (params.OVERRIDE_VERSION?.trim()) {
        return params.OVERRIDE_VERSION.trim()
    }
    // Optional per-component prefix from ci.env (e.g. VERSION_PREFIX=1.0), as in the original pipelines.
    def prefix = sh(script: "${ciEnv()}\necho \"\${VERSION_PREFIX:-}\"", returnStdout: true).trim()
    // Priority: ci.env VERSION_PREFIX > pipeline default (1.0) -> every component publishes as 1.0.<build>
    def root = prefix ?: env.DEFAULT_VERSION_PREFIX
    return env.IS_RELEASE == 'true' ? "${root}.${env.BUILD_NUMBER}"
                                    : "${root}.${env.BUILD_NUMBER}-SNAPSHOT"
}

// ---------------------------------------------------------------------
//  Backend (Maven) pipeline
// ---------------------------------------------------------------------

void runService(String svc, String displayName) {
    def version = ''
    try {
        stage("${svc}: Version") {
            dir(svc) {
                version = resolveVersion()
                // Set the version BEFORE building, so the tested artifact is the published one.
                sh "mvn -B -q versions:set -DnewVersion='${version}' -DgenerateBackupPoms=false"
                echo "${svc} -> ${version} (${env.IS_RELEASE == 'true' ? 'release' : 'snapshot'})"
            }
        }

        stage("${svc}: Build & Test") {
            dir(svc) {
                try {
                    sh 'mvn -B clean verify'
                } finally {
                    junit allowEmptyResults: true, testResults: 'target/surefire-reports/TEST-*.xml'
                }
            }
        }

        // Quality analysis and packaging are independent -> run concurrently.
        def par = [failFast: false]
        par["${svc}: SonarQube"] = {
            stage("${svc}: SonarQube") { sonarAnalysis(svc, displayName) }
        }
        if (params.DOCKER_BUILD) {
            par["${svc}: Docker"] = {
                stage("${svc}: Docker") {
                    // Docker problems mark the stage UNSTABLE but never fail the pipeline.
                    catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                        dockerBuild(svc, version)
                    }
                }
            }
        }
        parallel par

        if (params.ENFORCE_QUALITY_GATE) {
            stage("${svc}: Quality Gate") {
                dir(svc) {
                    timeout(time: 10, unit: 'MINUTES') {
                        def qg = waitForQualityGate()
                        if (qg.status != 'OK') {
                            error "Quality gate failed for ${svc}: ${qg.status}"
                        }
                    }
                }
            }
        }

        stage("${svc}: Publish to Nexus") {
            publishToNexus(svc)
        }
        serviceResults[svc] = 'SUCCESS'
    } catch (err) {
        serviceResults[svc] = 'FAILURE'
        throw err
    }
}

void sonarAnalysis(String svc, String displayName) {
    withSonarQubeEnv('SonarQube') {
        dir(svc) {
            sh """
                ${ciEnv()}
                mvn -B org.sonarsource.scanner.maven:sonar-maven-plugin:sonar \\
                  -Dsonar.projectKey="\${SONAR_PROJECT_KEY:-${svc}}" \\
                  -Dsonar.projectName="\${SONAR_PROJECT_NAME:-${displayName}}"
            """
        }
    }
}

void dockerBuild(String svc, String version) {
    dir(svc) {
        sh """
            ${ciEnv()}
            if [ "\${ENABLE_DOCKER_BUILD:-true}" = "false" ]; then
                echo "ENABLE_DOCKER_BUILD is false; skipping Docker packaging."; exit 0
            fi
            if ! docker info >/dev/null 2>&1; then
                echo "WARNING: cannot reach the Docker daemon."
                echo "Fix: sudo usermod -aG docker jenkins && sudo systemctl restart jenkins"
                exit 1
            fi
            ls target/*.jar >/dev/null 2>&1 || { echo "ERROR: no JAR in target/" >&2; exit 1; }

            IMG="\${DOCKER_IMAGE_NAME:-${svc}}"
            SHA=\$(git rev-parse --short HEAD)
            TAGS="-t \${IMG}:${version} -t \${IMG}:\${SHA}"
            [ "${env.IS_RELEASE}" = "true" ] && TAGS="\$TAGS -t \${IMG}:latest"   # 'latest' only for releases
            # Single ECR tag shared by every service; consumed by the Terraform deploy.
            [ "${env.DEPLOY_AWS}" = "true" ] && TAGS="\$TAGS -t gl5-g4-${svc}:\${DEPLOY_TAG}"

            DOCKERFILE=Dockerfile
            [ -f Dockerfile.ci ] && DOCKERFILE=Dockerfile.ci                       # reuses the jar built above
            docker build -f "\$DOCKERFILE" \$TAGS \\
              --label org.opencontainers.image.revision="\$SHA" \\
              --label org.opencontainers.image.version="${version}" .
        """
    }
}

void publishToNexus(String svc) {
    withCredentials([usernamePassword(credentialsId: 'nexus',
                                      usernameVariable: 'NEXUS_USER',
                                      passwordVariable: 'NEXUS_PASS')]) {
        dir(svc) {
            sh """
                set +x
                ${ciEnv()}
                NEXUS_BASE="\${NEXUS_BASE_URL:-http://host.docker.internal:8081}"
                RELEASE_REPO="\${NEXUS_RELEASE_REPO_NAME:-gl5-student-releases}"
                SNAPSHOT_REPO="\${NEXUS_SNAPSHOT_REPO_NAME:-gl5-student-snapshots}"
                RELEASE_ID="\${NEXUS_RELEASE_REPO_ID:-nexus-releases}"
                SNAPSHOT_ID="\${NEXUS_SNAPSHOT_REPO_ID:-nexus-snapshots}"

                # Server ids in settings.xml MUST equal the repo ids used for deploy below
                # (a mismatch means no credentials are sent -> 401). Passwords stay out of the
                # file: Maven resolves \${env.NEXUS_*} at runtime.
                trap 'rm -f ci-settings.xml' EXIT
                {
                  echo '<settings><servers>'
                  for ID in "\${SNAPSHOT_ID}" "\${RELEASE_ID}"; do
                    echo "<server><id>\${ID}</id><username>\\\${env.NEXUS_USER}</username><password>\\\${env.NEXUS_PASS}</password></server>"
                  done
                  echo '</servers></settings>'
                } > ci-settings.xml

                if [ "${env.IS_RELEASE}" = "true" ]; then
                    echo "Publishing RELEASE ${svc} to \${RELEASE_ID} (\${NEXUS_BASE})"
                    mvn -B -s ci-settings.xml deploy -DskipTests \\
                      -DaltReleaseDeploymentRepository="\${RELEASE_ID}::\${NEXUS_BASE}/repository/\${RELEASE_REPO}/"
                else
                    echo "Publishing SNAPSHOT ${svc} to \${SNAPSHOT_ID} (\${NEXUS_BASE})"
                    mvn -B -s ci-settings.xml deploy -DskipTests \\
                      -DaltSnapshotDeploymentRepository="\${SNAPSHOT_ID}::\${NEXUS_BASE}/repository/\${SNAPSHOT_REPO}/"
                fi
            """
        }
    }
}

// ---------------------------------------------------------------------
//  Frontend (npm / Angular) pipeline
// ---------------------------------------------------------------------

void runFrontend(String svc) {
    def version = ''
    withEnv([
        "IMAGE_NAME=${params.FRONTEND_IMAGE_NAME}",
        "IMAGE_TAG=${env.BUILD_NUMBER}",
        "SONAR_HOST_URL=${params.FRONTEND_SONAR_HOST_URL}",
        "SMOKE_HOST=${params.SMOKE_HOST}",
        "SMOKE_PORT=${params.SMOKE_PORT}"
    ]) {
        try {
            stage("${svc}: Version") {
                dir(svc) {
                    version = resolveVersion()   // same logic as the backend services
                    echo "${svc} -> ${version} (${env.IS_RELEASE == 'true' ? 'release' : 'snapshot'})"
                }
            }

            stage("${svc}: Install") {
                dir(svc) { sh 'npm ci --no-audit --no-fund' }
            }

            stage("${svc}: Lint") {
                dir(svc) { sh 'npm run lint' }
            }

            stage("${svc}: Test & Coverage") {
                dir(svc) {
                    sh 'npm run test:ci'
                    sh 'npm run coverage:normalize'
                }
            }

            stage("${svc}: Build") {
                dir(svc) { sh 'npm run build' }
            }

            stage("${svc}: SonarQube") {
                dir(svc) {
                    withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                        sh '''
                            set -eu
                            unset NODE_OPTIONS
                            sonar-scanner \
                                -Dsonar.host.url="$SONAR_HOST_URL" \
                                -Dsonar.token="$SONAR_TOKEN" \
                                -Dsonar.javascript.node.maxspace=2048 \
                                -Dsonar.working.directory=.scannerwork
                        '''
                    }
                }
            }

            if (params.ENFORCE_QUALITY_GATE) {
                stage("${svc}: Quality Gate") {
                    dir(svc) {
                        withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_TOKEN')]) {
                            timeout(time: 10, unit: 'MINUTES') {
                                sh '''
                                    set -euo pipefail

                                    REPORT=".scannerwork/report-task.txt"
                                    if [ ! -f "$REPORT" ]; then
                                      echo "ERROR: $REPORT is missing - the scanner did not submit an analysis"
                                      exit 1
                                    fi

                                    TASK_ID=$(sed -n 's/^ceTaskId=//p' "$REPORT" | head -n1)
                                    if [ -z "$TASK_ID" ]; then
                                      echo "ERROR: no ceTaskId in $REPORT"
                                      exit 1
                                    fi

                                    AUTH=$(printf '%s:' "$SONAR_TOKEN" | base64 | tr -d '\\n')
                                    sonar_api() { curl -fsS -H "Authorization: Basic $AUTH" "$SONAR_HOST_URL$1"; }

                                    echo "Waiting for analysis task $TASK_ID ..."
                                    ANALYSIS_ID=""
                                    for _ in $(seq 1 60); do
                                      TASK=$(sonar_api "/api/ce/task?id=$TASK_ID")
                                      TASK_STATUS=$(printf '%s' "$TASK" | jq -r '.task.status')
                                      case "$TASK_STATUS" in
                                        SUCCESS)
                                          ANALYSIS_ID=$(printf '%s' "$TASK" | jq -r '.task.analysisId')
                                          break
                                          ;;
                                        FAILED|CANCELED)
                                          echo "ERROR: analysis task $TASK_ID ended in $TASK_STATUS"
                                          exit 1
                                          ;;
                                        *)
                                          sleep 5
                                          ;;
                                      esac
                                    done

                                    if [ -z "$ANALYSIS_ID" ] || [ "$ANALYSIS_ID" = "null" ]; then
                                      echo "ERROR: analysis task $TASK_ID did not finish in time"
                                      exit 1
                                    fi

                                    GATE=$(sonar_api "/api/qualitygates/project_status?analysisId=$ANALYSIS_ID")
                                    printf '%s' "$GATE" | jq -r \
                                      '.projectStatus.conditions[]? | "  \\(.metricKey): \\(.status) (actual=\\(.actualValue // "-"), threshold=\\(.errorThreshold // "-"))"'
                                    GATE_STATUS=$(printf '%s' "$GATE" | jq -r '.projectStatus.status')

                                    case "$GATE_STATUS" in
                                      OK|WARN)
                                        echo "Quality gate: $GATE_STATUS"
                                        ;;
                                      *)
                                        echo "ERROR: quality gate: $GATE_STATUS"
                                        exit 1
                                        ;;
                                    esac
                                '''
                            }
                        }
                    }
                }
            }

            stage("${svc}: Docker Build") {
                dir(svc) {
                    sh 'docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" -t "${IMAGE_NAME}:latest" .'
                    if (env.DEPLOY_AWS == 'true') {
                        // Terraform/Helm pulls gl5-g4-frontend-service from ECR.
                        sh 'docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "gl5-g4-frontend-service:${DEPLOY_TAG}"'
                    }
                }
            }

            stage("${svc}: Smoke Test") {
                dir(svc) {
                    sh '''
                        set -eu
                        docker rm -f frontend-smoke >/dev/null 2>&1 || true
                        docker run -d --name frontend-smoke \
                          --add-host api-gateway:127.0.0.1 \
                          --add-host keycloak:127.0.0.1 \
                          -p "${SMOKE_PORT}:8080" \
                          "${IMAGE_NAME}:${IMAGE_TAG}"

                        ok=0
                        for i in $(seq 1 30); do
                          if curl -fsS "http://${SMOKE_HOST}:${SMOKE_PORT}/health" >/dev/null; then
                            ok=1
                            break
                          fi
                          sleep 2
                        done

                        if [ "$ok" != "1" ]; then
                          echo "Frontend did not become healthy on port ${SMOKE_PORT}"
                          docker logs frontend-smoke || true
                          exit 1
                        fi

                        curl -fsS "http://${SMOKE_HOST}:${SMOKE_PORT}/config.json" \
                          | jq -e '.apiBaseUrl and .keycloak.url and .keycloak.realm and .keycloak.clientId' >/dev/null

                        curl -fsS "http://${SMOKE_HOST}:${SMOKE_PORT}/" | grep -q '<app-root'

                        AUTH_CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://${SMOKE_HOST}:${SMOKE_PORT}/auth")
                        if [ "$AUTH_CODE" != "301" ]; then
                          echo "Expected /auth to redirect with 301, got $AUTH_CODE"
                          exit 1
                        fi

                        docker rm -f frontend-smoke >/dev/null
                    '''
                }
            }

            stage("${svc}: Publish to Nexus") {
                publishFrontendToNexus(svc, version)
            }
            serviceResults[svc] = 'SUCCESS'
        } catch (err) {
            serviceResults[svc] = 'FAILURE'
            throw err
        } finally {
            junit allowEmptyResults: true, testResults: "${svc}/coverage/junit.xml"
            archiveArtifacts artifacts: "${svc}/dist/cursus-frontend/**,${svc}/coverage/lcov.info", allowEmptyArchive: true
            sh 'docker rm -f frontend-smoke >/dev/null 2>&1 || true'
        }
    }
}

// ---------------------------------------------------------------------
//  AWS deployment (phases 1 to 4.2 of deploy/terraform/README.md)
//
//  Credentials come from jenkins-nexus-docker/.env through Compose
//  (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN / AWS_REGION).
//
//  Terraform state is NOT kept in the workspace (deleteDir() wipes it): it is
//  copied from/to TF_STATE_DIR on the jenkins-home volume before and after the
//  run, together with the ALB hostname and the provider plugin cache.
//
//    1. ECR repositories                 terraform apply -target
//    2. Tag and push all six images      docker tag + docker push
//    3. VPC/EKS/RDS/Helm application     terraform apply
//    4. ALB hostname + OIDC issuer       terraform apply -var public_hostname
//    5. Keycloak + API Gateway rollouts  kubectl rollout status
// ---------------------------------------------------------------------

void deployToAws(List components) {
    def region     = params.AWS_REGION?.trim() ?: 'us-east-1'
    def cluster    = params.AWS_CLUSTER_NAME?.trim() ?: 'gl5-g4'
    def stateDir   = params.TF_STATE_DIR?.trim() ?: '/var/jenkins_home/aws-terraform'
    def kubeconfig = "${stateDir}/kubeconfig"
    def tag        = env.DEPLOY_TAG
    def images     = components.collect { "gl5-g4-${it}" }
    def tfVars     = "-var aws_region=${region} -var cluster_name=${cluster}"
    def tfEnv      = "TF_IN_AUTOMATION=1 TF_PLUGIN_CACHE_DIR=${stateDir}/plugin-cache"

    try {
        stage('AWS: Preflight') {
            sh """
                set -eu
                missing=''
                for tool in aws terraform kubectl helm docker; do
                  command -v "\$tool" >/dev/null 2>&1 || missing="\$missing \$tool"
                done
                if [ -n "\$missing" ]; then
                  echo "ERROR: missing tools in this Jenkins agent:\$missing" >&2
                  echo "The AWS deploy needs aws-cli v2, terraform >= 1.9, kubectl, helm >= 3.16 and docker on PATH." >&2
                  exit 1
                fi

                : "\${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is missing: set it in jenkins-nexus-docker/.env and recreate Jenkins}"
                : "\${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is missing: set it in jenkins-nexus-docker/.env and recreate Jenkins}"
                if [ -z "\${AWS_SESSION_TOKEN:-}" ]; then
                  echo "NOTE: AWS_SESSION_TOKEN is empty (fine for long-lived keys, required for Learner Lab credentials)."
                fi

                aws --version
                terraform version
                helm version --short
                kubectl version --client
                aws sts get-caller-identity --region "${region}" --output text
                docker info >/dev/null

                for img in ${images.join(' ')}; do
                  docker image inspect "\${img}:${tag}" >/dev/null 2>&1 || {
                    echo "ERROR: image \${img}:${tag} is missing. Keep DOCKER_BUILD=true and check the Docker stages." >&2
                    exit 1
                  }
                done
            """
        }

        stage('AWS: Terraform Init') {
            dir('deploy/terraform') {
                sh """
                    set -eu
                    mkdir -p "${stateDir}" "${stateDir}/plugin-cache"
                    for f in terraform.tfstate terraform.tfstate.backup; do
                      if [ -f "${stateDir}/\$f" ]; then cp -f "${stateDir}/\$f" "\$f"; fi
                    done
                    ${tfEnv} terraform init -input=false
                """
            }
        }

        stage('AWS: Phase 1 - ECR repositories') {
            dir('deploy/terraform') {
                sh """
                    set -eu
                    ${tfEnv} terraform apply -auto-approve -input=false -target 'aws_ecr_repository.app' ${tfVars}
                """
            }
        }

        stage('AWS: Phase 2 - Build & push images') {
            sh """
                set -eu
                ACCOUNT_ID=\$(aws sts get-caller-identity --query Account --output text --region "${region}")
                REGISTRY="\${ACCOUNT_ID}.dkr.ecr.${region}.amazonaws.com"
                aws ecr get-login-password --region "${region}" | docker login --username AWS --password-stdin "\$REGISTRY"

                for img in ${images.join(' ')}; do
                  echo "Pushing \$REGISTRY/\${img}:${tag}"
                  docker tag "\${img}:${tag}" "\$REGISTRY/\${img}:${tag}"
                  docker push "\$REGISTRY/\${img}:${tag}"
                  if [ "${env.IS_RELEASE}" = "true" ] && [ "${tag}" != "latest" ]; then
                    docker tag "\${img}:${tag}" "\$REGISTRY/\${img}:latest"
                    docker push "\$REGISTRY/\${img}:latest"
                  fi
                done
            """
        }

        stage('AWS: Phase 3 - Provision & deploy') {
            // Keep the issuer stable across builds: reuse the hostname discovered last time.
            def savedHost = readStateFile(stateDir, 'public_hostname')
            def hostArg   = savedHost ? "-var public_hostname=${savedHost}" : ''
            dir('deploy/terraform') {
                applyWithRetry('AWS Phase 3 (terraform apply)') {
                    sh """
                        set -eu
                        ${tfEnv} terraform apply -auto-approve -input=false ${tfVars} -var image_tag=${tag} ${hostArg}
                    """
                }
            }
            sh """
                set -eu
                aws eks update-kubeconfig --name "${cluster}" --region "${region}" --kubeconfig "${kubeconfig}"
                KUBECONFIG="${kubeconfig}" kubectl get nodes
            """
            if (tag == 'latest') {
                // With a fixed tag the Helm values do not change between builds, so
                // Terraform leaves the release untouched and the pods would keep the
                // previous image. Restart the app deployments so the nodes pull the
                // freshly pushed :latest layers (pullPolicy=Always is set for it).
                sh """
                    set -eu
                    KUBECONFIG="${kubeconfig}" kubectl -n gl5-student rollout restart deployment/api-gateway deployment/student-service deployment/course-service deployment/department-service deployment/enrollment-service deployment/frontend
                """
            }
        }

        stage('AWS: Phase 4.1 - ALB hostname') {
            def alb = ''
            // No timeout for now: poll until the AWS Load Balancer Controller
            // publishes the Ingress hostname.
            waitUntil(initialRecurrencePeriod: 10000, quiet: true) {
                alb = sh(
                    script: "KUBECONFIG='${kubeconfig}' kubectl -n gl5-student get ingress frontend -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || true",
                    returnStdout: true
                ).trim()
                return alb != ''
            }

            echo "ALB hostname: ${alb}"
            dir('deploy/terraform') {
                applyWithRetry('AWS Phase 4.1 (public hostname)') {
                    sh """
                        set -eu
                        ${tfEnv} terraform apply -auto-approve -input=false ${tfVars} -var image_tag=${tag} -var public_hostname=${alb}
                    """
                }
            }
            sh "echo '${alb}' > '${stateDir}/public_hostname'"

            env.AWS_APP_URL = "http://${alb}/"
            currentBuild.description = "${env.SELECTED_SERVICES} @ ${tag} -> ${env.AWS_APP_URL}"
            echo "Application URL: ${env.AWS_APP_URL}"
        }

        stage('AWS: Phase 4.2 - Wait for rollouts') {
            try {
                sh """
                    set -eu
                    for d in keycloak api-gateway student-service course-service department-service enrollment-service frontend; do
                      KUBECONFIG="${kubeconfig}" kubectl -n gl5-student rollout status deployment/\$d
                    done
                """
            } catch (err) {
                sh """
                    set +e
                    KUBECONFIG="${kubeconfig}" kubectl -n gl5-student get pods -o wide
                    KUBECONFIG="${kubeconfig}" kubectl -n gl5-student get events --sort-by=.lastTimestamp | tail -n 30
                    KUBECONFIG="${kubeconfig}" kubectl -n gl5-student logs deployment/keycloak --tail=100
                    KUBECONFIG="${kubeconfig}" kubectl -n gl5-student logs deployment/api-gateway --tail=100
                    exit 0
                """
                throw err
            }
        }
    } finally {
        // Persist the state even when a phase failed, so the next run can resume.
        dir('deploy/terraform') {
            sh """
                set -eu
                mkdir -p "${stateDir}"
                for f in terraform.tfstate terraform.tfstate.backup; do
                  if [ -f "\$f" ]; then cp -f "\$f" "${stateDir}/"; fi
                done
            """
        }
    }
}

// Retries an AWS terraform apply on failure. The EKS API server can be briefly
// unreachable (e.g. "context deadline exceeded" while Helm discovers the API)
// right after a large Helm install such as kube-prometheus-stack. Replaying the
// apply is safe: Terraform re-plans against the state saved in `finally` and
// only acts on what is still missing. There is no timeout: each attempt runs to
// completion, only the number of attempts is bounded.
void applyWithRetry(String label, int attempts = 3, Closure body) {
    for (int i = 1; i <= attempts; i++) {
        try {
            echo "AWS apply: ${label} (attempt ${i}/${attempts})"
            body()
            return
        } catch (err) {
            if (i >= attempts) {
                throw err
            }
            echo "WARNING: ${label} failed on attempt ${i}/${attempts}: ${err.message}"
            echo 'The EKS API can be briefly unreachable after a large Helm install; retrying in 30s.'
            sleep(time: 30, unit: 'SECONDS')
        }
    }
}

String readStateFile(String stateDir, String name) {
    return sh(
        script: "cat '${stateDir}/${name}' 2>/dev/null || true",
        returnStdout: true
    ).trim()
}

// Publishes the built Angular app (dist/) as a versioned .tar.gz to a Nexus RAW hosted repo.
// Same release/snapshot switch, ci.env overrides and 'nexus' credential as the backend.
//   release  -> gl5-frontend-releases  (1.0.<build>)
//   snapshot -> gl5-frontend-snapshots (1.0.<build>-SNAPSHOT)
void publishFrontendToNexus(String svc, String version) {
    withCredentials([usernamePassword(credentialsId: 'nexus',
                                      usernameVariable: 'NEXUS_USER',
                                      passwordVariable: 'NEXUS_PASS')]) {
        dir(svc) {
            sh """
                set -e
                set +x
                ${ciEnv()}
                NEXUS_BASE="\${NEXUS_BASE_URL:-http://host.docker.internal:8081}"
                RELEASE_REPO="\${NEXUS_FRONTEND_RELEASE_REPO_NAME:-gl5-frontend-releases}"
                SNAPSHOT_REPO="\${NEXUS_FRONTEND_SNAPSHOT_REPO_NAME:-gl5-frontend-snapshots}"

                if [ "${env.IS_RELEASE}" = "true" ]; then
                    REPO="\$RELEASE_REPO"
                else
                    REPO="\$SNAPSHOT_REPO"
                fi

                # If Angular outputs to dist/cursus-frontend/browser, change DIST_DIR accordingly.
                DIST_DIR="dist/cursus-frontend"
                [ -d "\$DIST_DIR" ] || { echo "ERROR: \$DIST_DIR not found - was the build successful?" >&2; exit 1; }

                ARCHIVE="${svc}-${version}.tar.gz"
                trap 'rm -f "\$ARCHIVE"' EXIT
                tar -czf "\$ARCHIVE" -C "\$DIST_DIR" .

                echo "Publishing ${svc} ${version} to \${REPO} (\${NEXUS_BASE})"
                curl -fsS -u "\$NEXUS_USER:\$NEXUS_PASS" \\
                  --upload-file "\$ARCHIVE" \\
                  "\${NEXUS_BASE}/repository/\${REPO}/${svc}/${version}/\$ARCHIVE"
            """
        }
    }
}

// ---------------------------------------------------------------------
//  Notification (SendGrid v3 API)
//
//  The API key is the Jenkins secret-text credential `mail-api`.
//  The sender is the Jenkins "System Admin e-mail address"
//  (Manage Jenkins -> System), overridable with SENDGRID_FROM.
//  A notification failure never changes the build result.
// ---------------------------------------------------------------------

String mailSender() {
    def from = env.SENDGRID_FROM?.trim()
    if (from) {
        return from
    }
    try {
        // Jenkins "System Admin e-mail address" (Manage Jenkins -> System).
        from = jenkins.model.JenkinsLocationConfiguration.get().getAdminAddress()?.trim()
    } catch (err) {
        echo "WARNING: cannot read the Jenkins admin e-mail address: ${err.message}"
    }
    return from ?: (env.NOTIFY_EMAIL ?: '').trim()
}

void sendGridMail(String subject, String htmlBody) {
    def from = mailSender()
    def to   = (env.NOTIFY_EMAIL ?: '').trim()
    if (!from || !to) {
        echo 'WARNING: sender or recipient address is missing; skipping notification'
        return
    }
    try {
        withCredentials([string(credentialsId: 'mail-api', variable: 'SENDGRID_API_KEY')]) {
            writeFile file: '.sendgrid-mail-body.html', text: htmlBody
            withEnv([
                "MAIL_FROM=${from}",
                "MAIL_TO=${to}",
                "MAIL_SUBJECT=${subject}"
            ]) {
                sh '''
                    set -eu
                    set +x
                    trap 'rm -f .sendgrid-mail-body.html .sendgrid-mail-payload.json .sendgrid-mail-response.json' EXIT

                    jq -n \\
                      --arg from "$MAIL_FROM" \\
                      --arg to "$MAIL_TO" \\
                      --arg subject "$MAIL_SUBJECT" \\
                      --rawfile html .sendgrid-mail-body.html \\
                      '{
                         personalizations: [{ to: [{ email: $to }] }],
                         from: { email: $from },
                         subject: $subject,
                         content: [{ type: "text/html", value: $html }]
                       }' > .sendgrid-mail-payload.json

                    CODE=$(curl -sS -o .sendgrid-mail-response.json -w '%{http_code}' \\
                      -X POST https://api.sendgrid.com/v3/mail/send \\
                      -H "Authorization: Bearer $SENDGRID_API_KEY" \\
                      -H 'Content-Type: application/json' \\
                      --data-binary @.sendgrid-mail-payload.json)

                    if [ "$CODE" != "202" ]; then
                      echo "WARNING: SendGrid returned HTTP $CODE" >&2
                      cat .sendgrid-mail-response.json >&2 || true
                      exit 1
                    fi
                    echo "Build report sent to $MAIL_TO (from $MAIL_FROM)"
                '''
            }
        }
    } catch (err) {
        echo "WARNING: notification e-mail not sent: ${err.message}"
    }
}