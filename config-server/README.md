# Config Server

This Spring Cloud Config Server listens on port `8071`. By default it clones
configuration from a Git repository. The repository should contain files named
for each client application, for example `course-service-dev.properties` or
`student-service.yml`. Clients retrieve configuration from
`http://localhost:8071/{application}/{profile}`.

## Provide the server environment variables

Do not replace the `${...}` expressions in `src/main/resources/application.yml`
with credentials or tokens. Provide the values to the Config Server process
through your shell, IDE run configuration, or deployment environment.

| Variable | What to provide / where to get it |
| --- | --- |
| `CONFIG_REPO_URI` | Git clone URL of the configuration repository. In GitHub, open the repo and choose **Code → HTTPS** (or SSH if SSH is configured). The default in the YAML points at the project's `config-repo`; override it for your own repository. |
| `GIT_USER` | Your GitHub username, for a private HTTPS repository. |
| `GIT_TOKEN` | A GitHub Personal Access Token with read-only **Contents** access to the config repository. Create/manage it under GitHub **Settings → Developer settings → Personal access tokens**. Never commit or share it. Leave these credentials unset for a public repository. |
| `CONFIG_USER` | Username you choose for clients to authenticate to this Config Server. Must be set outside local development; without it the server refuses to start. |
| `CONFIG_PASSWORD` | Strong password you choose for Config Server clients. Must be set outside local development. Give the pair to the service developers through your team’s approved secret-sharing method, not in source control. |
| `ENCRYPT_KEY` | Strong encryption key you generate and keep secret, for example with `openssl rand -base64 32`. Config Server uses it for encrypting/decrypting configuration values. Must be set outside local development. |

Copy the repository-root `.env.example` to `.env`, then replace the example
repository URL and secret placeholders. `.env` is ignored by Git. Spring Boot
does not load `.env` files automatically, so from the repository root load it
into your shell before starting the server:

```sh
set -a
source .env
set +a
mvn -f config-server/pom.xml spring-boot:run
```

To run locally **without** providing environment variables, activate the `local`
profile, which supplies fallback credentials (`config` / `change-me`) and a
fallback encryption key:

```sh
SPRING_PROFILES_ACTIVE=local mvn -f config-server/pom.xml spring-boot:run
```

Do not activate `local` in deployment: it silently serves `config`/`change-me`
credentials and the hardcoded encryption key. Outside local development the
server fails to start unless `CONFIG_USER`, `CONFIG_PASSWORD` and `ENCRYPT_KEY`
are provided.

## Run with Docker

A multi-stage `Dockerfile` is included. Build and run the image with the same
environment variables (`.env` is not baked into the image):

```sh
docker build -t config-server config-server/
docker run -d --name config-server -p 8071:8071 \
  -e CONFIG_REPO_URI="$CONFIG_REPO_URI" \
  -e GIT_USER="$GIT_USER" \
  -e GIT_TOKEN="$GIT_TOKEN" \
  -e CONFIG_USER="$CONFIG_USER" \
  -e CONFIG_PASSWORD="$CONFIG_PASSWORD" \
  -e ENCRYPT_KEY="$ENCRYPT_KEY" \
  config-server
```

The image runs as a non-root user. JGit is a compile-time dependency so the
Git-backed repository works inside the container; `native` mode works too
(`-e SPRING_PROFILES_ACTIVE=native`).

Without the `CONFIG_USER`/`CONFIG_PASSWORD`/`ENCRYPT_KEY` variables the image
will not start; add `-e SPRING_PROFILES_ACTIVE=local` for a local-only run with
the fallback values. Never use `local` in deployment.

For a public repo, leave `GIT_USER` and `GIT_TOKEN` empty.
In IntelliJ or VS Code, put the variables in the Spring Boot run
configuration's **Environment variables** field. For deployment, use the
platform's secrets/environment-variable settings. Do not commit or share `.env`.

`default-label` is `main` in `application.yml`; change it if the config
repository uses a different branch. Add GitHub client credentials only when
the repository is private. The Config Server's Basic Auth credentials
(`CONFIG_USER` / `CONFIG_PASSWORD`) are separate from Git credentials and must
also be configured on each service client.

## Local native mode (no Git)

Service config files are already bundled in `config-server/src/main/resources/config/`
using Spring Cloud Config naming, such as `course-service-dev.properties`.
Start the server with the `native` profile:

```sh
SPRING_PROFILES_ACTIVE=native mvn -f config-server/pom.xml spring-boot:run
```

The native profile reads from `classpath:/config/` on the classpath. It still
uses Config Server Basic Auth, so either source `.env` or combine with the
`local` profile (`SPRING_PROFILES_ACTIVE=local,native`) to get the fallback
credentials and `change-me` encryption key; provide a strong key for any real
use (`openssl rand -base64 32`).

## Health and config endpoints

The health and info actuator endpoints are exposed at `/actuator/health` and
`/actuator/info`. Spring Security protects these endpoints as well as config
endpoints with Basic Auth using `CONFIG_USER` and `CONFIG_PASSWORD`, for example:

```sh
curl -u "$CONFIG_USER:$CONFIG_PASSWORD" \
  http://localhost:8071/course-service/dev
```

## Jenkins build, tests, and SonarQube

The [`Jenkinsfile`](./Jenkinsfile) runs the config-server Maven build and tests,
submits a SonarQube analysis, and waits for the quality gate. Its analysis
stages run only for `feature/config-server`. The final mail placeholder prints
`Mail Sent` to the Jenkins console; it does not send email.

### Jenkins and GitHub setup

1. Install the **Pipeline**, **GitHub Branch Source**, **Maven Integration**,
   and **SonarQube Scanner for Jenkins** plugins.
2. Configure a JDK installation in **Manage Jenkins → Tools** with the name
   `JDK17` and Java 17, and a Maven installation named `Maven3`. (The root
   Maven wrapper currently has no `.mvn/wrapper/maven-wrapper.properties`, so
   the pipeline uses Jenkins' Maven installation.)
3. Use a Linux Jenkins agent with Docker available to the build process. The
   config-server integration tests use Testcontainers; without Docker the test
   stage now fails rather than silently skipping those tests. For a containerized
   Jenkins built-in node, mount the host Docker socket into the Jenkins
   container and grant the Jenkins user access to the socket. Add
   `--add-host=host.docker.internal:host-gateway` to the Jenkins `docker run`
   command: the tests use this host address to reach Testcontainers' dynamically
   mapped ports from inside Jenkins. The pipeline sets
   `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal` for the test stage, and
   the test helper copies its temporary Git repository through the Docker API
   instead of relying on a host-side bind-mount path. For a separate agent,
   configure the equivalent host-reachable address in that agent's environment
   and Docker setup.
4. Create a **Multibranch Pipeline** job for this GitHub repository. Configure
   the GitHub branch source and credentials if the repository is private, and
   filter discovery to the `feature/config-server` branch. Set the Script Path
   to `config-server/Jenkinsfile`.
5. Enable GitHub push-event delivery to Jenkins. When Jenkins can configure
   webhooks through the GitHub Branch Source credentials, it can manage the
   webhook automatically. Otherwise, add a GitHub repository webhook pointing
   to `https://<your-jenkins-host>/github-webhook/` and select **Pushes**.
   Jenkins must be reachable by GitHub for webhook-triggered builds.
   If Jenkins reports a 403 while publishing a commit status, grant the GitHub
   token **Commit statuses: Read and write** access to this repository (or the
   classic `repo:status` scope). This is separate from checkout access.

### SonarQube setup

1. In Jenkins, open **Manage Jenkins → System → SonarQube servers**, enable
   **Environment variables**, add a server named exactly `SonarQube`, and
   configure its URL as `http://sonarqube:9000` and select an authentication
   token credential. The Jenkins container must be connected to the Docker
   network containing the `sonarqube` service. Keep the token in Jenkins
   credentials; do not put it in the Jenkinsfile or repository. The scanner and
   `waitForQualityGate` both use this Jenkins server configuration. Do not set
   the URL to `localhost`: inside Jenkins, that points back to the Jenkins
   container rather than SonarQube.
2. In SonarQube, add a project with key `gl5-g4-config-server` (or change
   `sonar.projectKey` in the Jenkinsfile to the key you use).
3. Configure the SonarQube webhook to
   `https://<your-jenkins-host>/sonarqube-webhook/`. Jenkins uses it to receive
   the analysis result for the quality-gate stage.
4. Push a commit to `feature/config-server`. In Jenkins, check the build/test
   results and the SonarQube project for code-quality and security findings.

SonarQube edition capabilities determine whether analyses can be reported as
feature-branch analyses; verify branch analysis support for the SonarQube
edition in use.

The pipeline stores Maven's local repository in `.m2/repository` under the
branch workspace so dependencies and Maven plugins are reused on later builds.
The `.m2/` directory is ignored by Git. To preserve this cache, reuse the
multibranch workspace between builds.

### Enabling email later

When email is configured, replace `echo 'Mail Sent'` in the Jenkinsfile's
`post` section with the Jenkins `emailext` step (from the **Email Extension**
plugin), and configure SMTP and recipients in Jenkins. Until then, each
completed build prints the placeholder message in its console log.
