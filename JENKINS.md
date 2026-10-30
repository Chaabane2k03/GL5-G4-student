# Jenkins CI

This project uses one shared Jenkins controller, separate Nexus and SonarQube
services, and Jenkins Configuration as Code. The current setup is in
[`jenkins-nexus-docker/`](jenkins-nexus-docker/).

Jenkins uses GitHub Branch Source to create multibranch jobs in the
`service-pipelines` folder. The configured branches are:

```text
main
develop
feature/jenkins-nexus
```

A branch is created only when the configured service `Jenkinsfile` exists on
that branch.

| Service | Jenkins job |
| --- | --- |
| department-service | `service-pipelines/department-service` |
| enrollment-service | `service-pipelines/enrollment-service` |
| student-service | `service-pipelines/student-service` |
| course-service | `service-pipelines/course-service` |
| api-gateway | `service-pipelines/api-gateway` |

Jenkins is available locally at <http://localhost:8092>. SonarQube is available
at <http://localhost:9000>, and Nexus is available at
<http://localhost:8081>.

## Prerequisites

- Docker Desktop with Compose v2.
- At least 4 GB of memory available to Docker.
- Ports `8081`, `8092`, `9000`, and `50000` available.
- The repository cloned locally.

## Setup

Run these commands from the repository root.

### 1. Start SonarQube

```powershell
docker compose -f docker-compose.sonar.yml up -d
```

Wait until <http://localhost:9000> reports status `UP`. In SonarQube, create a
token through **My Account → Security**.

### 2. Configure Jenkins and Nexus credentials

Create the local, git-ignored environment file:

```powershell
Copy-Item jenkins-nexus-docker\.env.example jenkins-nexus-docker\.env
notepad jenkins-nexus-docker\.env
```

Set real local values, especially:

```dotenv
JENKINS_ADMIN_USER=admin
JENKINS_ADMIN_PASSWORD=<jenkins-password>
JENKINS_EXTERNAL_URL=https://raedbettaher.chaabaneboussadia.dev/
SONAR_TOKEN=<sonarqube-token>
NEXUS_USER=admin
NEXUS_PASSWORD=<current-nexus-password>
```

Never commit or share `.env`; it contains credentials and tokens.

### 3. Create the shared network

Create the external network once. If it already exists, Docker reports that it
already exists and it can be reused.

```powershell
docker network create gl5-jenkins-nexus
```

### 4. Start Nexus

```powershell
docker compose -f jenkins-nexus-docker\docker-compose.nexus.yml up -d
docker compose -f jenkins-nexus-docker\docker-compose.nexus.yml ps
```

Open <http://localhost:8081>. On a new Nexus volume, retrieve the initial
password:

```powershell
docker exec nexus-igl5 cat /nexus-data/admin.password
```

After signing in, create these Maven hosted repositories through
**Server administration and configuration → Repositories → Create repository**:

| Name | Version policy | Deployment policy |
| --- | --- | --- |
| `gl5-student-snapshots` | Snapshot | Allow redeploy |
| `gl5-student-releases` | Release | Disable redeploy |

Use the `default` blob store and `Strict` layout policy. The names must match
the service `ci.env` files.

### 5. Build and start Jenkins

The first build downloads the JDK, Maven, and Jenkins plugins.

```powershell
docker compose -f jenkins-nexus-docker\docker-compose.jenkins.yml up -d --build
docker logs -f gl5-jenkins
```

Wait for:

```text
Jenkins is fully up and running
```

Open <http://localhost:8092> and sign in using the credentials from `.env`.
The CasC file [`casc.yaml`](jenkins-nexus-docker/casc.yaml) creates the
`service-pipelines` folder and all multibranch jobs.

### 6. Configure the GitHub push webhook

In the GitHub repository, open **Settings → Webhooks → Add webhook**:

```text
Payload URL: https://raedbettaher.chaabaneboussadia.dev/github-webhook/
Content type: application/json
Events: Just the push event
Active: enabled
```

The public hostname must forward HTTPS traffic to Jenkins on port `8092`.
After saving, open **Recent Deliveries** and confirm an HTTP `200` response.

Pushes to `main`, `develop`, or `feature/jenkins-nexus` trigger branch indexing.
The actual build runs in the discovered child branch job, not in the parent
multibranch indexing job.

### 7. Register the SonarQube webhook

After Jenkins and SonarQube are running:

```powershell
docker compose -f jenkins-nexus-docker\docker-compose.jenkins.yml run --rm sonar-webhook-init
```

The command should report that the webhook was registered or already exists.

## Running pipelines

There are two entry points, both inside the `service-pipelines` folder:

- `all-services` runs the root [`Jenkinsfile`](Jenkinsfile): one pipeline for the
  whole repository that builds only the services touched by the push, in
  parallel, with tests, SonarQube quality gate, container image and Nexus
  publishing. See [PIPELINE.md](PIPELINE.md) for the stages, parameters and
  change-detection rules.
- `department-service`, `enrollment-service`, `student-service`,
  `course-service` and `api-gateway` run the per-service Jenkinsfile of each
  folder.

To run the single pipeline:

1. Open Jenkins and enter the `service-pipelines` folder.
2. Open `all-services`.
3. If necessary, select **Scan Multibranch Pipeline Now**.
4. Open the discovered branch child job such as `feature/jenkins-nexus`.
5. Select **Build Now**, or **Build with Parameters** and set `BUILD_MODE=all`
   to rebuild every service.

To verify that change detection is doing what you expect, read the
`Detect changes` stage: it prints the scope and the list of services it selected.

The parent multibranch job's successful indexing build is not a service build.
It only discovers branches and Jenkinsfiles.

`PER_SERVICE_JOBS=false` (in `jenkins-nexus-docker/.env`, then recreate Jenkins)
stops creating the per-service jobs; delete the existing ones by hand if you
want `all-services` to be the only job.

Run builds one at a time when Docker has limited memory. Before running
pipelines that use application ports, stop the application stack if needed:

```powershell
docker compose -f docker-compose.yml down
```

## Verification

```powershell
docker compose -f jenkins-nexus-docker\docker-compose.jenkins.yml ps
docker compose -f jenkins-nexus-docker\docker-compose.nexus.yml ps
docker ps --filter "name=gl5-sonarqube"
docker exec gl5-jenkins sh -c "getent hosts nexus-igl5"
docker exec gl5-jenkins sh -c "curl -fsS http://nexus-igl5:8081/service/rest/v1/status"
```

The Jenkins-to-Nexus request should return a healthy Nexus status.

## Common problems

- **Jenkins returns `503` or repeatedly restarts:** inspect
  `docker logs gl5-jenkins`. A CasC or plugin error must be fixed before
  Jenkins can become ready.
- **CasC reports `repositoryUrl` is required:** ensure each GitHub source in
  [`casc.yaml`](jenkins-nexus-docker/casc.yaml) contains:
  `repositoryUrl('https://github.com/Chaabane2k03/GL5-G4-student')`.
- **A push only indexes branches:** open the discovered child branch job.
  Indexing itself does not execute a `Jenkinsfile`.
- **GitHub webhook returns `404`, `502`, or times out:** verify that the public
  hostname forwards to Jenkins and includes `/github-webhook/`.
- **`network gl5-sonar-net ... not found`:** start SonarQube first.
- **Nexus publishing fails:** verify the `nexus` Jenkins credential, the
  current Nexus password, repository names, and Nexus user permissions.
- **`port is already allocated`:** stop the application stack or change the
  relevant local port.

## Everyday commands

Run these from the repository root:

| Task | Command |
| --- | --- |
| Jenkins status | `docker compose -f jenkins-nexus-docker\docker-compose.jenkins.yml ps` |
| Jenkins logs | `docker logs -f gl5-jenkins` |
| Restart Jenkins | `docker compose -f jenkins-nexus-docker\docker-compose.jenkins.yml restart jenkins` |
| Apply `.env` changes | `docker compose -f jenkins-nexus-docker\docker-compose.jenkins.yml up -d --force-recreate jenkins` |
| Rebuild Jenkins | `docker compose -f jenkins-nexus-docker\docker-compose.jenkins.yml up -d --build --force-recreate` |
| Stop Jenkins, keep data | `docker compose -f jenkins-nexus-docker\docker-compose.jenkins.yml down` |
| Nexus status | `docker compose -f jenkins-nexus-docker\docker-compose.nexus.yml ps` |
| Stop Nexus, keep data | `docker compose -f jenkins-nexus-docker\docker-compose.nexus.yml down` |

To stop SonarQube:

```powershell
docker compose -f docker-compose.sonar.yml down
```

## Reset Jenkins data

This removes Jenkins jobs, credentials, and configuration stored in Jenkins
home. It does not remove Nexus data or the Maven cache:

```powershell
docker compose -f jenkins-nexus-docker\docker-compose.jenkins.yml down
docker volume rm gl5-jenkins_jenkins-home
docker compose -f jenkins-nexus-docker\docker-compose.jenkins.yml up -d --build
```

Do not remove `gl5-jenkins_nexus-data` unless a complete Nexus reset is
intended. Removing it deletes Nexus repositories and requires recreating them.

## Security

This setup mounts the host Docker socket into Jenkins. Anyone with sufficient
Jenkins permissions can therefore control Docker on the host. Change all
default credentials, keep `.env` files private, and do not expose Jenkins
without HTTPS and appropriate access controls.

For the detailed Jenkins/Nexus runbook, see
[`jenkins-nexus-docker/README.md`](jenkins-nexus-docker/README.md).
