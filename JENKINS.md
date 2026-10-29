# Jenkins CI

This project runs **one Jenkins controller per pipeline**, plus a **single shared
SonarQube**. Stopping or resetting one controller does not affect the others.

Jenkins clones the GitHub branch configured in each `jenkins/casc.yaml`, so the
changes must be **pushed** before a build. It does not read your local folder.

| Service | Jenkins job | URL | Branch |
| --- | --- | --- | --- |
| config-server | `config-server` | http://localhost:8091 | `feature/config-server` |
| department-service | `department-service` | http://localhost:8092 | `feature/department-service` |
| enrollment-service | `enrollment-service` | http://localhost:8093 | `feature/enrollment` |
| eureka-server | `Eureka-Server-CI` | http://localhost:8094 | `feature/eureka-server` |
| student-service | `student-service` | http://localhost:8095 | `feature/student_service` |

Shared SonarQube is at http://localhost:9000, with containers `gl5-sonarqube`
and `gl5-sonar-db`.

## Before you start

- Docker Desktop (or Docker Engine) with Compose v2.
- About 8 GB of RAM available to Docker; 10–12 GB is better for all five
  controllers plus Sonar.
- Ports `9000` and `8091`–`8095` free. During builds, `8082`, `8085`, `3309`
  and `3310` must also be free.
- The branch in each `jenkins/casc.yaml` contains these changes and is pushed.
  If everything is on one branch, change the `branch('...')` line in all five
  `jenkins/casc.yaml` files to that branch.

## Setup

### 1. Clone the repository

```sh
git clone https://github.com/Chaabane2k03/GL5-G4-student.git
cd GL5-G4-student
```

### 2. Start SonarQube and create a token

Start Sonar first: it creates the `gl5-sonar-net` network used by every controller.

```sh
docker compose -f docker-compose.sonar.yml up -d
```

Wait until http://localhost:9000 is up. Log in with `admin` / `admin` (Sonar may
ask you to change the password), then generate a token:

**My Account → Security → Generate Token**

### 3. Create the `.env` files

Each service needs a `.env`. They are git-ignored, so they must be created on
every machine.

```powershell
$services = 'config-server','department-service','enrollment-service','eureka-server','student-service'
foreach ($s in $services) {
    if (-not (Test-Path "$s/.env")) {
        Copy-Item "$s/.env.example" "$s/.env"
    }
}
```

Put the Sonar token in all five files:

```powershell
$token = '<paste-token-here>'
$services = 'config-server','department-service','enrollment-service','eureka-server','student-service'
foreach ($s in $services) {
    (Get-Content "$s/.env") -replace '^SONAR_TOKEN=.*$', "SONAR_TOKEN=$token" |
        Set-Content "$s/.env" -Encoding ascii
}
```

`config-server/.env` also needs the Config Server settings:

```dotenv
CONFIG_REPO_URI=https://github.com/Chaabane2k03/config-repo.git
GIT_USER=<github-user>
GIT_TOKEN=<github-token>
CONFIG_USER=config
CONFIG_PASSWORD=<config-server-password>
ENCRYPT_KEY=<config-repo-encryption-key>
```

Each service uses `admin` / `admin` for Jenkins by default. If you change
`JENKINS_PORT`, change `JENKINS_EXTERNAL_URL` to match.

### 4. Build and start the controllers

Run them one at a time. The first build downloads Maven, the JDK and Jenkins
plugins, so it takes a few minutes.

```powershell
$services = 'config-server','department-service','enrollment-service','eureka-server','student-service'
foreach ($s in $services) {
    Push-Location $s
    docker compose -f docker-compose.jenkins.yml up -d --build
    Pop-Location
}
```

Log in at each URL with `admin` / `admin` unless you changed the `.env`.
Wait a minute or two for the job to appear.

### 5. Register the Sonar webhooks

The quality gate needs SonarQube to call Jenkins back. This also disables Sonar's
private-address check, which would otherwise reject the internal webhook URL.

```powershell
$services = 'config-server','department-service','enrollment-service','eureka-server','student-service'
foreach ($s in $services) {
    Push-Location $s
    docker compose -f docker-compose.jenkins.yml run --rm sonar-webhook-init
    Pop-Location
}
```

Each run should end with `Registered webhook ...`.

### 6. Check everything

- Five controllers are running: `docker ps --filter "name=jenkins"`.
- All five Jenkins URLs open and show their job.
- SonarQube shows five webhooks under **Administration → Configuration → Webhooks**.

## Run the pipelines

Click **Build Now** in each Jenkins job. Run them one after another; five
simultaneous builds can run the Docker VM out of memory.

| Job | What it does |
| --- | --- |
| `config-server` | Build, tests, Sonar, quality gate |
| `department-service` | H2 tests, MySQL smoke test, Sonar, quality gate |
| `enrollment-service` | Build, tests, Sonar, Docker image |
| `Eureka-Server-CI` | Build, tests, Sonar, quality gate, Docker image |
| `student-service` | H2 tests, MySQL smoke test, Sonar, quality gate |

A healthy setup finishes with **SUCCESS** for all five jobs.

Before running department or student, stop the main application stack so its
ports do not clash:

```sh
docker compose -f docker-compose.yml down
```

## Common problems

- **`network gl5-sonar-net ... not found`** — start Sonar first.
- **`SONAR_TOKEN is empty`** — fill it in `.env`, run `up -d`, then re-run the
  webhook init.
- **`Invalid URL: loopback...`** — re-run `sonar-webhook-init`; it disables the
  Sonar webhook URL check.
- **Job fails at checkout** — the configured branch is missing or was not pushed.
- **Quality gate never finishes** — the webhook is missing or the token is wrong.
  Check the webhook list in Sonar.
- **`port is already allocated`** — stop the app stack or change the port in
  `.env` and `JENKINS_EXTERNAL_URL`.
- **Controllers die or Jenkins is slow** — give Docker more memory and run
  pipelines one at a time.
- **Login fails after editing `.env`** — recreate the controller with `up -d`.

## Everyday commands

Run these from a service directory.

| Task | Command |
| --- | --- |
| Show status | `docker compose -f docker-compose.jenkins.yml ps` |
| Follow logs | `docker compose -f docker-compose.jenkins.yml logs -f jenkins` |
| Restart Jenkins | `docker compose -f docker-compose.jenkins.yml restart jenkins` |
| Apply `.env` changes | `docker compose -f docker-compose.jenkins.yml up -d` |
| Rebuild the image | `docker compose -f docker-compose.jenkins.yml up -d --build` |
| Stop, keep data | `docker compose -f docker-compose.jenkins.yml down` |
| Stop and delete data | `docker compose -f docker-compose.jenkins.yml down -v` |

To stop SonarQube, use `docker compose -f docker-compose.sonar.yml down`.
Adding `-v` deletes its projects and tokens; generate a new token and re-register
the webhooks afterwards.

## Security

This setup is for local development only:

- Change the default `admin` / `admin` login.
- The controllers mount the host Docker socket, so anyone using Jenkins can
  control Docker on the host.
- Do not expose these ports to the internet.
- Never commit `.env` files; they contain the Sonar token and Git secrets.

See [README.md](README.md) for the application stack and
[docker-compose.sonar.yml](docker-compose.sonar.yml) for the shared Sonar setup.
