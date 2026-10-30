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
        timeout(time: 60, unit: 'MINUTES')
    }

    environment {
        NOTIFY_EMAIL     = 'chaabaneboussadia@gmail.com'
        RELEASE_BRANCH   = 'main'
        DEFAULT_VERSION_PREFIX = '1.0'   // all components publish as 1.0.<build number>
        // MAVEN_OPTS (shared local repo) is already set by docker-compose.jenkins.yml
    }

    parameters {
        // ---- common ----
        booleanParam(name: 'BUILD_ALL', defaultValue: false,
            description: 'Build every component (backend + frontend), ignoring change detection')
        string(name: 'ONLY_SERVICES', defaultValue: '',
            description: 'Optional comma-separated list of components to build (e.g. api-gateway,student-service,frontend-service)')
        booleanParam(name: 'ENFORCE_QUALITY_GATE', defaultValue: true,
            description: 'Fail a component if its SonarQube quality gate fails')
        booleanParam(name: 'DOCKER_BUILD', defaultValue: true,
            description: 'Build Docker images for selected backend services; the frontend image is built when selected')

        // ---- release / versioning (backend + frontend) ----
        booleanParam(name: 'FORCE_RELEASE', defaultValue: false,
            description: 'Force release deployment to Nexus regardless of git branch')
        string(name: 'OVERRIDE_VERSION', defaultValue: '',
            description: 'Optional manual version override for all components (e.g. 1.2.0)')

        // ---- frontend ----
        string(name: 'FRONTEND_IMAGE_NAME', defaultValue: 'gl5-g4-frontend-service',
            description: 'Frontend Docker image repository name')
        string(name: 'FRONTEND_SONAR_HOST_URL', defaultValue: 'http://host.docker.internal:9000',
            description: 'SonarQube URL as seen from this controller (used by the frontend scanner)')
        string(name: 'SMOKE_HOST', defaultValue: 'host.docker.internal',
            description: 'Host used to reach the frontend smoke container')
        string(name: 'SMOKE_PORT', defaultValue: '4300',
            description: 'Host port for the frontend smoke container')
        booleanParam(name: 'PUBLISH_FRONTEND_ARCHIVE', defaultValue: true,
            description: 'Publish the frontend dist archive (.tar.gz) to the Nexus raw repositories')
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
                    env.SELECTED_SERVICES = selectServices(SERVICES.keySet() as List, FRONTEND,
                                                           GLOBAL_PATHS, BACKEND_PATHS).join(',')
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
                    def branches = [:]
                    for (String svc : env.SELECTED_SERVICES.split(',')) {
                        def name = svc
                        if (name == FRONTEND) {
                            branches[name] = { runFrontend(name) }
                        } else {
                            def displayName = SERVICES[name]
                            branches[name] = { runService(name, displayName) }
                        }
                    }
                    branches.failFast = false   // one failing component must not hide the others
                    parallel branches
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
                emailext(
                    to: env.NOTIFY_EMAIL,
                    subject: "${env.JOB_NAME} - Build #${env.BUILD_NUMBER} - ${currentBuild.currentResult}",
                    mimeType: 'text/html',
                    body: """
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
    def branch = (env.BRANCH_NAME ?: env.GIT_BRANCH ?: '').replaceFirst('^origin/', '')
    return branch == env.RELEASE_BRANCH || params.FORCE_RELEASE
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

            if (params.PUBLISH_FRONTEND_ARCHIVE) {
                stage("${svc}: Publish to Nexus") {
                    publishFrontendToNexus(svc, version)
                }
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