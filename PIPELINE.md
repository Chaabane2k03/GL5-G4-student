# Single pipeline (all services)

`Jenkinsfile` at the repository root is the single CI/CD entry point for the
whole monorepo. It replaces the need to open seven separate jobs: one
multibranch job, `service-pipelines/all-services`, builds every service that a
push actually touched, in parallel, with the same quality contract.

The per-service `Jenkinsfile` files are still supported and still work. They are
the independent entry point for one service; the root `Jenkinsfile` is the
repository-wide entry point. Both read the same `ci.env` files, so versioning,
Sonar keys and Nexus repositories stay defined in one place per service.

## Stages

```
Checkout
  └─ Preflight                     toolchain + Docker + registry sanity checks
  └─ Detect changes                git diff -> list of services to build
  └─ Build, test, analyse and package        (one parallel branch per service)
       ├─ config-server      ┐
       ├─ eureka-server      │  Build & test   mvn clean verify
       ├─ api-gateway        │  Static analysis SonarQube + quality gate
       ├─ department-service ├─ Container image Dockerfile.ci / Dockerfile
       ├─ enrollment-service │  Publish artifact Nexus release or snapshot
       ├─ course-service     │
       └─ student-service    ┘
  └─ Security scan                 optional, Trivy HIGH/CRITICAL (off by default)
  └─ Build report                  per-service markdown table + description
post: JUnit results, jars, notification
```

## Pipeline contract per service

| Step | Command / action | Result |
|---|---|---|
| Build & test | `mvn -B -ntp clean verify` in `<service>/` | jar, surefire reports, JaCoCo data |
| Static analysis | `sonar-maven-plugin:sonar -Dsonar.qualitygate.wait=true` | gate blocks the branch |
| Container image | `docker build -f Dockerfile.ci` when present, otherwise `Dockerfile` | immutable tags |
| Publish | `mvn deploy` with `altReleaseDeploymentRepository` / `altSnapshotDeploymentRepository` | Nexus artifact |

The jar built in **Build & test** is the jar used by the image (`Dockerfile.ci`
copies `target/*.jar`) and by Nexus. Nothing is compiled twice.

### Image tags

| Tag | When | Meaning |
|---|---|---|
| `<service>:<BUILD_NUMBER>-<short-sha>` | every build | immutable traceable build |
| `<service>:<short-sha>` | every build | commit addressable |
| `<service>:latest` | release branch only (`main`, or `FORCE_RELEASE`) | current release |
| `$DOCKER_REGISTRY/<service>:...` | only if `DOCKER_REGISTRY` is set | pushed image |

Images carry `org.opencontainers.image.*` labels (title, version, revision,
source).

### Artifact versions

Same scheme as the per-service jobs, read from each `ci.env`:

- release branch (`RELEASE_BRANCH`, default `main`), or `FORCE_RELEASE=true`:
  `${VERSION_PREFIX}.${BUILD_NUMBER}`
- every other branch: `${VERSION_PREFIX}.${BUILD_NUMBER}-SNAPSHOT`
- `OVERRIDE_VERSION` wins over both

Snapshots go to `gl5-student-snapshots`, releases to `gl5-student-releases`.

## Change detection

The pipeline builds only what the push changed:

| Situation | Base for the diff |
|---|---|
| Branch has a previous successful build | `GIT_PREVIOUS_SUCCESSFUL_COMMIT..HEAD` |
| Pull request | merge-base with `CHANGE_TARGET` |
| Feature branch | merge-base with `origin/develop` |
| Push to `main` / `develop` | `HEAD^..HEAD` |
| History unavailable, or `BUILD_MODE=all` | every service |

A file matches a service when its path starts with `<service>/`. Changing one of
the pipeline contract files rebuilds everything:

- `Jenkinsfile`
- `.mvn/`
- `jenkins-nexus-docker/casc.yaml`

If a change touches nothing that belongs to a service (documentation, for
example), the pipeline finishes green with a "nothing to build" report instead
of running seven empty builds.

Services can declare `dependsOn` in the `SERVICES` list. Dependants are added
automatically when a dependency changes (none are declared today because the
services are independent at build time).

## Parameters

| Parameter | Default | Effect |
|---|---|---|
| `BUILD_MODE` | `changed` | `changed` builds only touched services, `all` builds everything |
| `SERVICES` | empty | explicit comma-separated list, overrides `BUILD_MODE` |
| `SKIP_TESTS` | `false` | `-DskipTests` |
| `SKIP_SONAR` | `false` | skip analysis and quality gate |
| `SKIP_DOCKER` | `false` | skip image builds |
| `SKIP_NEXUS` | `false` | skip publishing |
| `SECURITY_SCAN` | `false` | run Trivy on the built images (pulls `aquasec/trivy`) |
| `FORCE_RELEASE` | `false` | publish a release version from any branch |
| `OVERRIDE_VERSION` | empty | fixed version, e.g. `1.2.0` |
| `EMAIL_RECIPIENTS` | empty | recipients for the build report; empty disables mail |

Pull request builds never publish to Nexus.

## Running it

1. Jenkins → `service-pipelines` → `all-services`.
2. Open the branch (`main`, `develop`, `feature/jenkins-nexus`).
3. **Scan Multibranch Pipeline Now** after the first push so the branch and the
   root `Jenkinsfile` are discovered.
4. **Build Now**, or **Build with Parameters** for a full rebuild:
   `BUILD_MODE=all`.

A push to one of the tracked branches triggers the same pipeline through the
GitHub webhook (see [JENKINS.md](JENKINS.md)).

### Per-service jobs

`jenkins-nexus-docker/casc.yaml` still creates the five per-service jobs by
default, so a push can build twice (once per service, once through
`all-services`). Once the single pipeline is trusted, stop creating the
per-service jobs:

```dotenv
# jenkins-nexus-docker/.env
PER_SERVICE_JOBS=false
```

```powershell
docker compose -f jenkins-nexus-docker\docker-compose.jenkins.yml up -d --force-recreate jenkins
```

Job DSL leaves jobs in place when they stop being defined, so delete the
`service-pipelines/*-service` and `api-gateway` jobs by hand if you want a
single job only. Their build history disappears with them.

## Adding a service

1. Add the folder with its `pom.xml`, `Dockerfile.ci` (or `Dockerfile`) and
   `ci.env`.
2. Add one row to `SERVICES` in `Jenkinsfile`:

   ```groovy
   [name: 'notification-service', path: 'notification-service', port: 8086,
    sonarKey: 'notification-service', sonarName: 'Notification Service', dependsOn: []]
   ```

3. Push. The next build detects the new path and builds it with the same
   contract. No other change is needed.

## Concurrency and resources

- The job runs `disableConcurrentBuilds()`: one build of `all-services` at a
  time, so the shared Maven repository and the Docker daemon are not
  oversubscribed.
- Jenkins currently has `numExecutors: 2` in `casc.yaml`. The parallel branches
  queue two at a time; raise it for faster feedback if the host has memory for
  it. Each Maven build plus its Testcontainers is roughly 1-1.5 GB.
- All services share `/var/jenkins_home/.m2/repository` (the `maven-repo`
  volume). Dependencies download once; Maven 3.9 handles concurrent resolution,
  and the rare lock warning is harmless.
- Tests use random ports and Testcontainers, so parallel execution is safe.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Nothing to build` on a real change | The diff base did not include the commit. Run once with `BUILD_MODE=all`, then normal behaviour resumes. |
| `Unknown service(s) in SERVICES` | Typo in the `SERVICES` parameter; use the names from the `SERVICES` list. |
| Sonar step fails with a gate error | Read the gate conditions in SonarQube. Fix the code, or run with `SKIP_SONAR=true` when analysing an unrelated branch. |
| `no jar in .../target` | `clean verify` failed earlier in the same branch; check the **Build & test** stage first. |
| Image step fails with `docker info` | The Jenkins container lost access to `/var/run/docker.sock`; restart Jenkins. |
| Nexus `401`/`403` | The `nexus` credential expired or the user cannot deploy to the repository. Update `NEXUS_PASSWORD` in `jenkins-nexus-docker/.env` and recreate Jenkins. |
| Build aborted by the 90 minute timeout | Raise `timeout` in the `options` block, or build the services separately with the `SERVICES` parameter. |
| Old images pile up on the host | Clean them explicitly: `docker image prune -f --filter "label=org.opencontainers.image.title"` (never prune blindly on a shared daemon). |

## Next steps (not implemented on purpose)

- Extract the helpers into a Jenkins shared library once a second repository
  needs the same pipeline.
- Add a deployment stage (Compose/Kubernetes) that consumes the published
  version instead of rebuilding.
- Enable `SECURITY_SCAN` in CI once the Trivy image is available offline, and
  add image signing (`cosign`) before pushing to a registry.
- Push images to a registry in CI instead of only building them locally: set
  `DOCKER_REGISTRY` and create a `docker-registry` username/password credential
  in Jenkins.
