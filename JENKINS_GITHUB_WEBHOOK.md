# Jenkins CI on a Local Machine, Exposed with Cloudflare Tunnel

Run Jenkins locally in Docker, reach it securely at `https://jenkins.chaabaneboussadia.dev` through a Cloudflare Tunnel, and trigger a pipeline on every GitHub push.

## Architecture

```
GitHub push
    |
    v  POST https://jenkins.chaabaneboussadia.dev/github-webhook/
Cloudflare edge  (HTTPS, Zero Trust Access)
    |   /github-webhook/  -> Bypass (public)
    |   everything else   -> Allow only my email
    v
cloudflared (systemd service on the local machine)
    |
    v  http://localhost:8080
Jenkins (Docker container) -> Multibranch Pipeline -> Jenkinsfile
```

Nothing is opened on the router. The tunnel makes an outbound connection to Cloudflare, and Jenkins only listens on `127.0.0.1`.

## Prerequisites

- A Linux machine (or WSL2) with Docker and Docker Compose
- A domain added to Cloudflare (free plan), status **Active**
- `cloudflared` installed
- A GitHub repository with a `Jenkinsfile`
- The machine must stay awake (disable sleep/hibernate), otherwise the pipeline goes offline

## 1. Start Jenkins

`docker-compose.yml`:

```yaml
services:
  jenkins:
    image: jenkins/jenkins:lts
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
    volumes:
      - jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock   # only if builds need Docker

volumes:
  jenkins_home:
```

```bash
docker compose up -d
docker compose logs -f jenkins     # copy the initial admin password
```

Open `http://localhost:8080`, paste the password, install the suggested plugins, and create the admin user.

## 2. Create the Cloudflare Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create jenkins
cloudflared tunnel route dns jenkins jenkins.chaabaneboussadia.dev
```

`tunnel create` writes a credentials file to `~/.cloudflared/<TUNNEL-ID>.json`. **Keep it secret.**

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: jenkins
credentials-file: /etc/cloudflared/<TUNNEL-ID>.json
ingress:
  - hostname: jenkins.chaabaneboussadia.dev
    service: http://localhost:8080
  - service: http_status:404
```

## 3. Install the tunnel as a service

The service runs as root, so `~` means `/root` and it will not find your home folder. Copy the files to `/etc/cloudflared` first:

```bash
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/config.yml /etc/cloudflared/config.yml
sudo cp ~/.cloudflared/<TUNNEL-ID>.json /etc/cloudflared/
sudo sed -i 's#/home/<user>/.cloudflared#/etc/cloudflared#' /etc/cloudflared/config.yml

sudo cloudflared service install
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared      # expect: active (running)
```

Open `https://jenkins.chaabaneboussadia.dev`. You should see the Jenkins login page.

After any config change:

```bash
sudo systemctl restart cloudflared
```

## 4. Protect Jenkins with Cloudflare Access

Go to **Zero Trust -> Access -> Applications -> Add an application -> Self-hosted and private -> Public DNS**.

**Application 1: the Jenkins UI**

| Field | Value |
|---|---|
| Name | `Jenkins` |
| Subdomain / Domain | `jenkins` / `chaabaneboussadia.dev` |
| Path | empty |
| Policy | Action **Allow**, include **Emails** = your email |

**Application 2: the webhook endpoint**

| Field | Value |
|---|---|
| Name | `Jenkins webhook` |
| Subdomain / Domain | `jenkins` / `chaabaneboussadia.dev` |
| Path | `github-webhook/` |
| Policy | Action **Bypass**, include **Everyone** |

Bypass policies are evaluated first, so GitHub can reach the webhook while the rest of Jenkins stays behind an email login.

**Verify:**

```bash
curl -I https://jenkins.chaabaneboussadia.dev/github-webhook/
```

`HTTP/2 405` with `x-jenkins` headers is correct. The endpoint only accepts POST, and `curl -I` sends HEAD. A `302` to `cloudflareaccess.com` means the Bypass app is not matching.

## 5. Configure Jenkins

1. **Manage Jenkins -> System -> Jenkins URL** = `https://jenkins.chaabaneboussadia.dev/`
2. Install the plugins **GitHub Branch Source** and **Pipeline** (usually included in the suggested set).
3. Create a GitHub token (see next section) and add it as a credential.

## 6. Create a GitHub token

GitHub -> **Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens -> Generate new token**

- **Repository access:** Only select repositories -> `Chaabane2k03/test-jenkins`
- **Repository permissions:**

| Permission | Access |
|---|---|
| Contents | Read-only |
| Metadata | Read-only |

Optional: **Commit statuses** (read/write) to show checks on commits, **Pull requests** (read-only) to build PRs. Skip **Administration**, since the webhook is created manually.

Copy the token immediately, GitHub shows it only once.

In Jenkins: **Manage Jenkins -> Credentials -> System -> Global credentials -> Add Credentials**

- **Kind:** Username with password
- **Username:** `Chaabane2k03`
- **Password:** the token
- **ID:** `github-token`

## 7. Create the Multibranch Pipeline

1. **New Item -> Multibranch Pipeline**
2. **Branch Sources -> Add source -> GitHub**
3. **Credentials:** `github-token`
4. **Repository URL:** `https://github.com/Chaabane2k03/test-jenkins`
5. Save. Jenkins scans the repo and looks for a `Jenkinsfile` in the root.

Minimal `Jenkinsfile`:

```groovy
pipeline {
  agent any
  stages {
    stage('Hello') {
      steps { echo "Triggered by push on ${env.BRANCH_NAME}" }
    }
  }
}
```

## 8. Add the GitHub webhook

Repo -> **Settings -> Webhooks -> Add webhook**

| Field | Value |
|---|---|
| Payload URL | `https://jenkins.chaabaneboussadia.dev/github-webhook/` (keep the trailing slash) |
| Content type | `application/json` |
| Secret | empty (optional, see Hardening) |
| SSL verification | Enable |
| Events | Just the push event |
| Active | checked |

GitHub sends a `ping` immediately. Under **Recent Deliveries** you want a green check with response `200`.

## 9. Test

```bash
git commit --allow-empty -m "test webhook"
git push
```

Jenkins should start a build within seconds. If it does not, check **Scan Repository Log** on the job and the delivery response in GitHub.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `cloudflared service install`: "Cannot determine default configuration path" | Config is not in `/etc/cloudflared`. Copy `config.yml` and the `.json` there (step 3). |
| `cloudflared service install`: "already installed" | Harmless. Run `sudo systemctl enable --now cloudflared` instead. |
| Webhook delivery 302 / login page | Bypass app for `github-webhook/` is not matching. Check the path and that the action is Bypass. |
| Webhook delivery 403 | Access still blocking, or Jenkins auth/CSRF issue. |
| Webhook delivery 404 | Wrong URL, or GitHub plugin missing. |
| Webhook delivery 502 / timeout | Tunnel or Jenkins is down. Check `docker compose ps` and `systemctl status cloudflared`. |
| Scan fails: "Could not list branches" / 403 | Token does not include the repo, or Contents is not set to read. |
| Tunnel logs: "version outdated" | Harmless warning. Upgrade `cloudflared` when convenient. |

Useful commands:

```bash
docker compose ps
docker compose logs -f jenkins
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 30 --no-pager
```

## Hardening

- Set a webhook **Secret** on GitHub and configure the same shared secret in Jenkins (Manage Jenkins -> System -> GitHub).
- Use role-based or matrix authorization in Jenkins, and disable anonymous access.
- Do not run heavy builds on the controller. Add a separate agent once pipelines grow.
- Rotate the GitHub token before it expires, and delete the tunnel to revoke its credentials if the `.json` file leaks.

## Backup

```bash
docker run --rm -v jenkins_home:/data -v $PWD:/backup alpine \
  tar czf /backup/jenkins_home_$(date +%F).tgz -C /data .
```


