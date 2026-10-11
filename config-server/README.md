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
