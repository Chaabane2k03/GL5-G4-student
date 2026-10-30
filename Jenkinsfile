// =====================================================================
//  Unified CI/CD pipeline for all microservices (monorepo)
//  Services: api-gateway, course-service, department-service,
//            enrollment-service, student-service
//
//  Flow per service (services run in parallel, independently):
//    Version -> Build & Test -> [ SonarQube || Docker build ] -> Quality Gate -> Publish to Nexus
//
//  Only services whose files changed are built (or all, via BUILD_ALL / shared-file change).
// =====================================================================

// Single source of truth: add a new service here and it is picked up automatically.
def SERVICES = [
    'api-gateway'       : 'API Gateway',
    'course-service'    : 'Course Service',
    'department-service': 'Department Service',
    'enrollment-service': 'Enrollment Service',
    'student-service'   : 'Student Service'
]

// Files that affect every service (root pom, CI config...) -> rebuild everything.
def SHARED_PATHS = ['Jenkinsfile', 'pom.xml', 'common/', 'shared/']

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
        DEFAULT_VERSION_PREFIX = '1.0'   // all services publish as 1.0.<build number>
        // MAVEN_OPTS (shared local repo) is already set by docker-compose.jenkins.yml
    }

    parameters {
        booleanParam(name: 'BUILD_ALL', defaultValue: false,
            description: 'Build every service, ignoring change detection')
        string(name: 'ONLY_SERVICES', defaultValue: '',
            description: 'Optional comma-separated list of services to build (e.g. api-gateway,student-service)')
        booleanParam(name: 'FORCE_RELEASE', defaultValue: false,
            description: 'Force release deployment to Nexus regardless of git branch')
        string(name: 'OVERRIDE_VERSION', defaultValue: '',
            description: 'Optional manual version override (e.g. 1.2.0). Applies to all selected services.')
        booleanParam(name: 'ENFORCE_QUALITY_GATE', defaultValue: true,
            description: 'Fail a service if its SonarQube quality gate fails')
        booleanParam(name: 'DOCKER_BUILD', defaultValue: true,
            description: 'Build Docker images')
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Detect Changes') {
            steps {
                script {
                    env.IS_RELEASE = (isReleaseBuild() ? 'true' : 'false')
                    env.SELECTED_SERVICES = selectServices(SERVICES.keySet() as List, SHARED_PATHS).join(',')
                    echo "Branch release mode : ${env.IS_RELEASE}"
                    echo "Services to build   : ${env.SELECTED_SERVICES ?: '(none)'}"
                    currentBuild.description = env.SELECTED_SERVICES ?: 'no changes'
                }
            }
        }

        stage('Services') {
            when { expression { env.SELECTED_SERVICES } }
            steps {
                script {
                    def branches = [:]
                    for (String svc : env.SELECTED_SERVICES.split(',')) {
                        def name = svc
                        def displayName = SERVICES[name]
                        branches[name] = { runService(name, displayName) }
                    }
                    branches.failFast = false   // one failing service must not hide the others
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
                          <tr><th>Service</th><th>Result</th></tr>
                          ${rows ?: '<tr><td colspan="2">No services built (no changes detected)</td></tr>'}
                        </table>
                        <p><a href="${env.BUILD_URL}">Build details</a> |
                           <a href="${env.BUILD_URL}console">Console output</a></p>
                    """
                )
            }
        }
        success { echo 'All selected services built successfully' }
        failure { echo 'One or more services failed' }
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

List selectServices(List all, List sharedPaths) {
    if (params.ONLY_SERVICES?.trim()) {
        def wanted = params.ONLY_SERVICES.split(',').collect { it.trim() }
        return all.findAll { wanted.contains(it) }
    }
    if (params.BUILD_ALL) { return all }

    def base = env.GIT_PREVIOUS_SUCCESSFUL_COMMIT ?: env.GIT_PREVIOUS_COMMIT
    if (!base) {
        echo 'No previous commit known -> building all services'
        return all
    }
    def changed = sh(script: "git diff --name-only ${base} HEAD || true", returnStdout: true)
                    .trim().split('\n').findAll { it }
    if (changed.any { f -> sharedPaths.any { f.startsWith(it) } }) {
        echo 'Shared files changed -> building all services'
        return all
    }
    return all.findAll { svc -> changed.any { it.startsWith("${svc}/") } }
}

// Loads optional, non-secret CI overrides (ci.env) inside the service folder.
String ciEnv() {
    return '[ -f ci.env ] && set -a && . ./ci.env && set +a || true'
}

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

String resolveVersion() {
    if (params.OVERRIDE_VERSION?.trim()) {
        return params.OVERRIDE_VERSION.trim()
    }
    def pomVersion = sh(
        script: "mvn -B help:evaluate -Dexpression=project.version -q -DforceStdout 2>/dev/null | grep -v '\\[' | tail -n 1",
        returnStdout: true).trim()
    // Optional per-service prefix from ci.env (e.g. VERSION_PREFIX=1.0), as in the original pipelines.
    def prefix = sh(script: "${ciEnv()}\necho \"\${VERSION_PREFIX:-}\"", returnStdout: true).trim()
    // Priority: ci.env VERSION_PREFIX > pipeline default (1.0) -> every service publishes as 1.0.<build>
    def root = prefix ?: env.DEFAULT_VERSION_PREFIX
    return env.IS_RELEASE == 'true' ? "${root}.${env.BUILD_NUMBER}"
                                    : "${root}.${env.BUILD_NUMBER}-SNAPSHOT"
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