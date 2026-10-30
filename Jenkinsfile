#!/usr/bin/env groovy
/*
 * GL5 - single CI/CD pipeline for every service in this repository.
 *
 * One multibranch job (service-pipelines/all-services) runs this file. Every
 * service gets its own parallel build with the same contract:
 *
 *   1. Build and test          mvn clean verify (jar + tests + coverage)
 *   2. Static analysis         SonarQube scanner + quality gate
 *   3. Container image         Dockerfile.ci (prebuilt jar) or Dockerfile
 *   4. Publish artifact        Nexus release/snapshot (branch aware)
 *
 * Design rules:
 *   - `SERVICES` is the only place a service is described. Add a row there and
 *     the pipeline picks it up; nothing else in this file changes.
 *   - Only services touched by the push are built (per-service ci.env still owns
 *     versioning, Sonar keys and Nexus repository names).
 *   - The jar is built once and reused by the container image and by Nexus.
 *   - A failure in one service does not stop the others: the full matrix runs
 *     and the build fails at the end with a per-service report.
 *   - Pull requests never publish artifacts.
 *
 * The per-service Jenkinsfiles still exist and still work. They are the
 * independent build entry point for a single service; this file is the
 * repository-wide entry point. See PIPELINE.md.
 */

/* -------------------------------------------------------------------------
 * Service registry - the single source of truth for the pipeline.
 * Keep this list in sync with the services supported by the aggregate build.
 * ---------------------------------------------------------------------- */
def SERVICES = [
    [name: 'api-gateway',        path: 'api-gateway',        port: 8072, sonarKey: 'api-gateway',           sonarName: 'API Gateway',        dependsOn: []],
    [name: 'department-service', path: 'department-service', port: 8082, sonarKey: 'department-service',    sonarName: 'Department Service', dependsOn: []],
    [name: 'enrollment-service', path: 'enrollment-service', port: 8083, sonarKey: 'enrollment-service',    sonarName: 'Enrollment Service', dependsOn: []],
    [name: 'course-service',     path: 'course-service',     port: 8084, sonarKey: 'course-service',        sonarName: 'Course Service',     dependsOn: []],
    [name: 'student-service',    path: 'student-service',    port: 8085, sonarKey: 'student-service',       sonarName: 'Student Service',    dependsOn: []]
]

/*
 * Files that describe the build itself. Touching one of them rebuilds every
 * service, because the pipeline contract may have changed for all of them.
 */
def SHARED_PATHS = ['Jenkinsfile', '.mvn/', 'jenkins-nexus-docker/casc.yaml']

/* Per-service outcome, filled in by the parallel branches. */
def RESULTS = [:]

/* -------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------- */

/**
 * Returns the list of files changed by this build, an empty list when nothing
 * changed, or null when the pipeline cannot tell (then everything is built,
 * which is the safe default).
 */
def detectChangedPaths() {
    def out = sh(script: '''
set +e
set +x
range=""

# Preferred: everything since the last successful build of this branch.
if [ -n "${GIT_PREVIOUS_SUCCESSFUL_COMMIT:-}" ] && \
   git cat-file -e "${GIT_PREVIOUS_SUCCESSFUL_COMMIT}^{commit}" 2>/dev/null; then
    range="${GIT_PREVIOUS_SUCCESSFUL_COMMIT}..HEAD"

# Pull requests: everything since the branch point with the target branch.
elif [ -n "${CHANGE_TARGET:-}" ]; then
    git fetch --quiet origin "+refs/heads/${CHANGE_TARGET}:refs/remotes/origin/${CHANGE_TARGET}" >/dev/null 2>&1
    mb=$(git merge-base HEAD "origin/${CHANGE_TARGET}" 2>/dev/null)
    [ -n "$mb" ] && range="$mb..HEAD"

# Feature branches: everything since the branch point with develop.
elif [ "${BRANCH_NAME:-}" != "main" ] && [ "${BRANCH_NAME:-}" != "develop" ]; then
    git fetch --quiet origin "+refs/heads/develop:refs/remotes/origin/develop" >/dev/null 2>&1
    mb=$(git merge-base HEAD origin/develop 2>/dev/null)
    [ -n "$mb" ] && range="$mb..HEAD"

# main/develop: the commits of this push.
else
    git rev-parse --verify -q "HEAD^" >/dev/null 2>&1 && range="HEAD^..HEAD"
fi

if [ -z "$range" ]; then
    echo "ALL"
    exit 0
fi

files=$(git diff --name-only "$range" 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "ALL"
    exit 0
fi

if [ -z "$files" ]; then
    echo "NONE"
else
    echo "$files"
fi
''', returnStdout: true).trim()

    if (out == 'ALL') {
        return null
    }
    if (!out || out == 'NONE') {
        return []
    }
    return out.readLines().collect { it.trim() }.findAll { it }
}

/**
 * Turns the changed paths into the list of service names to build.
 * Explicit SERVICES parameter > BUILD_MODE=all > untraceable history >
 * shared path changed > changed service paths (+ dependent services).
 */
def selectServices(List changedPaths) {
    def explicit = params.SERVICES?.trim() ? params.SERVICES.split(',').collect { it.trim() }.findAll { it } : []
    if (explicit) {
        def unknown = explicit.findAll { n -> !SERVICES.any { it.name == n } }
        if (unknown) {
            error "Unknown service(s) in SERVICES: ${unknown.join(', ')}. Valid names: ${SERVICES*.name.join(', ')}"
        }
        return explicit
    }
    if (params.BUILD_MODE == 'all' || changedPaths == null) {
        return SERVICES*.name
    }
    if (changedPaths.isEmpty()) {
        return []
    }

    def sharedChanged = changedPaths.any { p ->
        SHARED_PATHS.any { s -> p == s || p.startsWith(s.endsWith('/') ? s : s + '/') }
    }
    if (sharedChanged) {
        return SERVICES*.name
    }

    def selected = SERVICES.findAll { svc ->
        changedPaths.any { p -> p.startsWith(svc.path + '/') }
    }.collect { it.name } as List

    // Include services that depend on a changed service, transitively.
    boolean grew = true
    while (grew) {
        grew = false
        SERVICES.each { svc ->
            def deps = svc.dependsOn ?: []
            if (!(svc.name in selected) && deps.any { it in selected }) {
                selected << svc.name
                grew = true
            }
        }
    }
    return selected
}

def selectedServiceNames() {
    return env.SELECTED_SERVICES?.trim() ? env.SELECTED_SERVICES.split(',').collect { it.trim() }.findAll { it } : []
}

def serviceByName(String name) {
    def svc = SERVICES.find { it.name == name }
    if (!svc) {
        error "Service '${name}' is not registered in the SERVICES list of the Jenkinsfile."
    }
    return svc
}

/**
 * Full lifecycle of one service: build, test, analyse, package, publish.
 * Sub-stages are rendered under the parallel branch of that service.
 */
def runService(Map svc, Map result) {
    stage('Build & test') {
        dir(svc.path) {
            withEnv(["MAVEN_TEST_FLAGS=${params.SKIP_TESTS ? '-DskipTests' : '-DskipTests=false'}"]) {
                sh '''
                    set -eu
                    echo "Service: ${SERVICE_NAME} | branch: ${BRANCH_NAME:-detached} | commit: ${GIT_SHORT_SHA:-unknown}"
                    mvn ${MAVEN_ARGS} ${MAVEN_TEST_FLAGS} \
                        -Dmaven.repo.local="${MAVEN_REPO_LOCAL}" \
                        clean verify
                '''
            }
        }
        result.build = 'OK'
    }

    stage('Static analysis') {
        if (params.SKIP_SONAR) {
            echo "SonarQube analysis skipped (SKIP_SONAR=true)"
            result.sonar = 'SKIPPED'
        } else {
            withSonarQubeEnv(env.SONAR_ENV) {
                withEnv(["SONAR_KEY=${svc.sonarKey}", "SONAR_NAME=${svc.sonarName}"]) {
                    dir(svc.path) {
                        sh '''
                            set -eu
                            # qualitygate.wait makes the scanner block until the
                            # gate is computed, so parallel branches stay correct
                            # without relying on the SonarQube webhook callback.
                            mvn ${MAVEN_ARGS} -Dmaven.repo.local="${MAVEN_REPO_LOCAL}" \
                                org.sonarsource.scanner.maven:sonar-maven-plugin:sonar \
                                -Dsonar.projectKey="${SONAR_KEY}" \
                                -Dsonar.projectName="${SONAR_NAME}" \
                                -Dsonar.qualitygate.wait=true \
                                -Dsonar.qualitygate.timeout=600
                        '''
                    }
                }
            }
            result.sonar = 'PASSED'
        }
    }

    stage('Container image') {
        if (params.SKIP_DOCKER) {
            echo "Container image skipped (SKIP_DOCKER=true)"
            result.image = 'SKIPPED'
        } else {
            def releaseBranch = isReleaseBuild()
            withEnv([
                "IMAGE_NAME=${svc.name}",
                "IMAGE_TAG=${env.BUILD_NUMBER}-${env.GIT_SHORT_SHA}",
                "IS_RELEASE=${releaseBranch}"
            ]) {
                dir(svc.path) {
                    sh '''
                        set -eu
                        rm -f .docker-skipped
                        # Each service owns its packaging switch in ci.env.
                        [ -f ci.env ] && set -a && . ./ci.env && set +a
                        if [ "${ENABLE_DOCKER_BUILD:-true}" = "false" ]; then
                            echo "ENABLE_DOCKER_BUILD is false in ci.env; skipping the image."
                            touch .docker-skipped
                            exit 0
                        fi
                        if ! docker info >/dev/null 2>&1; then
                            echo "ERROR: the Jenkins container cannot reach the Docker daemon." >&2
                            exit 1
                        fi
                        if ! ls target/*.jar >/dev/null 2>&1; then
                            echo "ERROR: no jar in ${PWD}/target; the image cannot be built." >&2
                            exit 1
                        fi

                        DOCKERFILE=Dockerfile.ci
                        [ -f "$DOCKERFILE" ] || DOCKERFILE=Dockerfile

                        TAGS="-t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:${GIT_SHORT_SHA}"
                        if [ "$IS_RELEASE" = "true" ]; then
                            TAGS="$TAGS -t ${IMAGE_NAME}:latest"
                        fi

                        echo "Building ${IMAGE_NAME}:${IMAGE_TAG} with ${DOCKERFILE}"
                        docker build -f "$DOCKERFILE" $TAGS \
                            --label "org.opencontainers.image.title=${IMAGE_NAME}" \
                            --label "org.opencontainers.image.version=${IMAGE_TAG}" \
                            --label "org.opencontainers.image.revision=${GIT_COMMIT:-unknown}" \
                            --label "org.opencontainers.image.source=${GIT_URL:-local}" \
                            .
                        docker images "${IMAGE_NAME}" --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}'
                    '''
                }

                if (fileExists("${svc.path}/.docker-skipped")) {
                    result.image = 'SKIPPED'
                } else if (env.DOCKER_REGISTRY?.trim()) {
                    // Optional: push to a registry when one is configured for Jenkins.
                    withCredentials([usernamePassword(
                        credentialsId: env.DOCKER_CREDENTIALS_ID ?: 'docker-registry',
                        usernameVariable: 'REGISTRY_USER',
                        passwordVariable: 'REGISTRY_PASS'
                    )]) {
                        sh '''
                            set -eu
                            echo "$REGISTRY_PASS" | docker login "$DOCKER_REGISTRY" \
                                --username "$REGISTRY_USER" --password-stdin
                            docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
                            docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
                            if [ "$IS_RELEASE" = "true" ]; then
                                docker tag "${IMAGE_NAME}:${IMAGE_TAG}" "${DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
                                docker push "${DOCKER_REGISTRY}/${IMAGE_NAME}:latest"
                            fi
                            docker logout "$DOCKER_REGISTRY" || true
                        '''
                    }
                    result.image = 'PUSHED'
                } else {
                    result.image = 'BUILT'
                }
            }
        }
    }

    stage('Publish artifact') {
        if (env.CHANGE_ID) {
            echo "Pull request build: artifacts are not published to Nexus."
            result.nexus = 'SKIPPED (pull request)'
        } else if (params.SKIP_NEXUS) {
            echo "Nexus publishing skipped (SKIP_NEXUS=true)"
            result.nexus = 'SKIPPED'
        } else {
            withCredentials([usernamePassword(
                credentialsId: env.NEXUS_CREDENTIALS_ID,
                usernameVariable: 'NEXUS_USER',
                passwordVariable: 'NEXUS_PASS'
            )]) {
                withEnv([
                    "FORCE_RELEASE=${params.FORCE_RELEASE}",
                    "OVERRIDE_VERSION=${params.OVERRIDE_VERSION}"
                ]) {
                    dir(svc.path) {
                        sh '''
                            set +x
                            set -eu
                            trap 'rm -f settings.xml' EXIT

                            [ -f ci.env ] && set -a && . ./ci.env && set +a
                            [ -f .env.local ] && set -a && . ./.env.local && set +a
                            [ -f .env ] && set -a && . ./.env && set +a

                            NEXUS_BASE="${NEXUS_BASE_URL:-http://nexus-igl5:8081}"
                            RELEASE_REPO="${NEXUS_RELEASE_REPO_NAME:-gl5-student-releases}"
                            SNAPSHOT_REPO="${NEXUS_SNAPSHOT_REPO_NAME:-gl5-student-snapshots}"
                            RELEASE_ID="${NEXUS_RELEASE_REPO_ID:-nexus-releases}"
                            SNAPSHOT_ID="${NEXUS_SNAPSHOT_REPO_ID:-nexus-snapshots}"
                            TARGET_RELEASE_BRANCH="${RELEASE_BRANCH:-main}"

                            RELEASE_URL="${NEXUS_BASE}/repository/${RELEASE_REPO}/"
                            SNAPSHOT_URL="${NEXUS_BASE}/repository/${SNAPSHOT_REPO}/"

                            cat > settings.xml <<EOF
<settings>
  <servers>
    <server><id>${SNAPSHOT_ID}</id><username>${NEXUS_USER}</username><password>${NEXUS_PASS}</password></server>
    <server><id>${RELEASE_ID}</id><username>${NEXUS_USER}</username><password>${NEXUS_PASS}</password></server>
  </servers>
</settings>
EOF

                            CURRENT_BRANCH=$(echo "${BRANCH_NAME:-${GIT_BRANCH:-}}" | sed 's|^origin/||')
                            echo "Detected branch: '${CURRENT_BRANCH}' (release branch: '${TARGET_RELEASE_BRANCH}')"

                            if [ -n "${OVERRIDE_VERSION:-}" ]; then
                                TARGET_VERSION="${OVERRIDE_VERSION}"
                            else
                                CURRENT_POM_VERSION=$(mvn -B help:evaluate -Dexpression=project.version \
                                    -q -DforceStdout 2>/dev/null | grep -F -v "[" | tail -n 1)
                                BASE_VERSION=$(echo "${CURRENT_POM_VERSION}" | sed -E 's/-SNAPSHOT$//')
                                VERSION_ROOT="${VERSION_PREFIX:-$BASE_VERSION}"
                                if [ "${CURRENT_BRANCH}" = "${TARGET_RELEASE_BRANCH}" ] || [ "${FORCE_RELEASE}" = "true" ]; then
                                    TARGET_VERSION="${VERSION_ROOT}.${BUILD_NUMBER}"
                                else
                                    TARGET_VERSION="${VERSION_ROOT}.${BUILD_NUMBER}-SNAPSHOT"
                                fi
                            fi

                            mvn -B versions:set -DnewVersion="${TARGET_VERSION}" -DgenerateBackupPoms=false

                            if [ "${CURRENT_BRANCH}" = "${TARGET_RELEASE_BRANCH}" ] || [ "${FORCE_RELEASE}" = "true" ]; then
                                echo "Publishing RELEASE ${TARGET_VERSION} -> ${RELEASE_URL}"
                                mvn -B -s settings.xml deploy -DskipTests \
                                    -DaltReleaseDeploymentRepository="${RELEASE_ID}::default::${RELEASE_URL}" \
                                    -Dnexus.url="${NEXUS_BASE}" -Dnexus.release.repo="${RELEASE_REPO}"
                                echo "RELEASE:${TARGET_VERSION}" > .nexus-published
                            else
                                echo "Publishing SNAPSHOT ${TARGET_VERSION} -> ${SNAPSHOT_URL}"
                                mvn -B -s settings.xml deploy -DskipTests \
                                    -DaltSnapshotDeploymentRepository="${SNAPSHOT_ID}::default::${SNAPSHOT_URL}" \
                                    -Dnexus.url="${NEXUS_BASE}" -Dnexus.snapshot.repo="${SNAPSHOT_REPO}"
                                echo "SNAPSHOT:${TARGET_VERSION}" > .nexus-published
                            fi
                        '''
                        result.nexus = sh(
                            script: 'cat .nexus-published 2>/dev/null || echo published',
                            returnStdout: true
                        ).trim()
                    }
                }
            }
        }
    }
}

def isReleaseBuild() {
    if (env.CHANGE_ID) {
        return false
    }
    def releaseBranch = env.RELEASE_BRANCH ?: 'main'
    return env.BRANCH_NAME == releaseBranch || params.FORCE_RELEASE
}

/* -------------------------------------------------------------------------
 * Pipeline
 * ---------------------------------------------------------------------- */
pipeline {
    agent any

    tools {
        jdk 'JDK17'
        maven 'Maven3'
    }

    options {
        timestamps()
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
        timeout(time: 90, unit: 'MINUTES')
    }

    parameters {
        choice(
            name: 'BUILD_MODE',
            choices: ['changed', 'all'],
            description: 'changed: build only services touched by this push. all: build every service.'
        )
        string(
            name: 'SERVICES',
            defaultValue: '',
            description: 'Optional comma-separated list to build, e.g. api-gateway,student-service. Overrides BUILD_MODE.'
        )
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: false,
            description: 'Skip unit tests (compilation and coverage are still produced).'
        )
        booleanParam(
            name: 'SKIP_SONAR',
            defaultValue: false,
            description: 'Skip SonarQube analysis and the quality gate.'
        )
        booleanParam(
            name: 'SKIP_DOCKER',
            defaultValue: false,
            description: 'Skip container image builds.'
        )
        booleanParam(
            name: 'SKIP_NEXUS',
            defaultValue: false,
            description: 'Skip publishing artifacts to Nexus.'
        )
        booleanParam(
            name: 'FORCE_RELEASE',
            defaultValue: false,
            description: 'Publish a release version even when the branch is not the release branch.'
        )
        string(
            name: 'OVERRIDE_VERSION',
            defaultValue: '',
            description: 'Optional fixed version (e.g. 1.2.0).'
        )
        string(
            name: 'EMAIL_RECIPIENTS',
            defaultValue: '',
            description: 'Optional comma-separated recipients for the build report.'
        )
    }

    environment {
        MAVEN_ARGS           = '-B -ntp -Dstyle.color=never'
        MAVEN_REPO_LOCAL     = '/var/jenkins_home/.m2/repository'
        SONAR_ENV            = 'SonarQube'
        NEXUS_CREDENTIALS_ID = 'nexus'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_SHORT_SHA = sh(
                        script: 'git rev-parse --short=12 HEAD',
                        returnStdout: true
                    ).trim()
                    env.GIT_COMMIT_MESSAGE = sh(
                        script: 'git log -1 --pretty=%s',
                        returnStdout: true
                    ).trim()
                }
            }
        }

        stage('Preflight') {
            steps {
                script {
                    sh '''
                        set -eu
                        echo "Java:    $(java -version 2>&1 | head -n 1)"
                        echo "Maven:   $(mvn -version | head -n 1)"
                        echo "Docker:  $(docker --version)"
                        echo "Compose: $(docker compose version --short 2>/dev/null || echo 'not installed')"
                        docker info >/dev/null 2>&1 || {
                            echo "ERROR: Docker daemon is not reachable; tests using Testcontainers and image builds require it." >&2
                            exit 1
                        }
                    '''
                    SERVICES.each { svc ->
                        if (!fileExists("${svc.path}/pom.xml")) {
                            error "Service '${svc.name}' is registered but ${svc.path}/pom.xml does not exist."
                        }
                    }
                    // Non-blocking contract check: the compose file must stay renderable.
                    sh 'docker compose -f docker-compose.yml config -q >/dev/null 2>&1 || echo "WARN: docker-compose.yml does not render with the current environment."'
                }
            }
        }

        stage('Detect changes') {
            steps {
                script {
                    def changed = detectChangedPaths()
                    def selected = selectServices(changed)
                    env.SELECTED_SERVICES = selected.join(',')
                    env.CHANGE_SCOPE = changed == null
                        ? 'all services (change history unavailable)'
                        : (changed.isEmpty() ? 'no changed files' : "${changed.size()} changed file(s)")
                    echo "Scope: ${env.CHANGE_SCOPE}"
                    echo "Services to build: ${env.SELECTED_SERVICES ?: 'none'}"
                    if (!selected) {
                        echo 'Nothing to build. Documentation-only or unrelated change; exiting successfully.'
                    }
                }
            }
        }

        stage('Build, test, analyse and package') {
            when {
                expression { return !selectedServiceNames().isEmpty() }
            }
            steps {
                script {
                    def branches = [:]
                    selectedServiceNames().each { name ->
                        def serviceName = name
                        def service = serviceByName(serviceName)
                        def serviceResult = [build: 'PENDING', sonar: 'PENDING', image: 'PENDING', nexus: 'PENDING']
                        RESULTS[serviceName] = serviceResult
                        branches[serviceName] = {
                            withEnv(["SERVICE_NAME=${serviceName}"]) {
                                catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                                    runService(service, serviceResult)
                                }
                            }
                            serviceResult.keySet().findAll { key -> serviceResult[key] == 'PENDING' }.each { key ->
                                serviceResult[key] = 'FAILED'
                            }
                        }
                    }
                    parallel branches
                }
            }
        }

        stage('Build report') {
            steps {
                script {
                    def lines = ['| Service | Build & test | SonarQube | Image | Nexus |', '|---|---|---|---|---|']
                    selectedServiceNames().each { name ->
                        def r = RESULTS[name]
                        lines << r
                            ? "| ${name} | ${r.build} | ${r.sonar} | ${r.image} | ${r.nexus} |"
                            : "| ${name} | not built | - | - | - |"
                    }
                    def report = lines.join('\n') + '\n'
                    echo "\n${report}"
                    writeFile file: 'build-summary.md', text: report
                    archiveArtifacts artifacts: 'build-summary.md', allowEmptyArchive: true
                    currentBuild.description = "${env.BUILD_NUMBER} · ${env.BRANCH_NAME} · ${env.SELECTED_SERVICES ?: 'nothing to build'}"
                }
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: '**/target/surefire-reports/TEST-*.xml'
            archiveArtifacts artifacts: '**/target/*.jar', allowEmptyArchive: true
            script {
                if (params.EMAIL_RECIPIENTS?.trim()) {
                    emailext(
                        to: params.EMAIL_RECIPIENTS,
                        subject: "[${currentBuild.currentResult}] ${env.JOB_NAME} #${env.BUILD_NUMBER} (${env.BRANCH_NAME})",
                        mimeType: 'text/html',
                        body: """
                            <h2>GL5 pipeline ${currentBuild.currentResult}</h2>
                            <ul>
                                <li><strong>Job:</strong> ${env.JOB_NAME}</li>
                                <li><strong>Branch:</strong> ${env.BRANCH_NAME}</li>
                                <li><strong>Commit:</strong> ${env.GIT_SHORT_SHA} - ${env.GIT_COMMIT_MESSAGE}</li>
                                <li><strong>Services:</strong> ${env.SELECTED_SERVICES ?: 'none'}</li>
                                <li><strong>Build:</strong> <a href="${env.BUILD_URL}">#${env.BUILD_NUMBER}</a></li>
                            </ul>
                        """
                    )
                }
            }
        }
        success {
            echo "Pipeline succeeded for: ${env.SELECTED_SERVICES ?: 'no changed service'}"
        }
        failure {
            echo "Pipeline failed. See the per-service stages and build-summary.md."
        }
        unstable {
            echo "Pipeline is unstable. Review the warnings in the logs."
        }
    }
}
