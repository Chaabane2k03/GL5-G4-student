# Déploiement Kubernetes (Helm)

Ce dossier contient les charts Helm permettant de déployer la plateforme GL5-G4 Student sur Kubernetes (Minikube en local, EKS en production).

## Architecture

- **Namespace `gl5-student`** : frontend, API Gateway, 4 microservices (Spring Boot), 4 bases MySQL (Minikube) ou Amazon RDS (EKS), Keycloak (Identity Provider)
- **Ingress** : Nginx Ingress (Minikube) ou AWS ALB (EKS) → frontend uniquement. L'API Gateway reste interne au cluster.
- **Réseau** : NetworkPolicies en mode "deny by default", seuls les flux autorisés sont ouverts.
- **Configuration** : ConfigMaps/Secrets (pas de Config Server). DNS Kubernetes (pas d'Eureka).
- **Secrets (EKS)** : External Secrets Operator synchronise depuis AWS Secrets Manager.

## Structure

```text
deploy/helm/
├── charts/                    # Charts génériques réutilisables
│   ├── microservice/          # Chart générique pour les microservices Spring Boot
│   ├── frontend/              # Nginx + reverse proxy vers API Gateway
│   ├── mysql/                 # MySQL StatefulSet
│   ├── keycloak/               # Keycloak + import du realm
├── umbrella/                  # Umbrella charts
│   └── gl5-student/           # Plateforme applicative
└── values/                    # Valeurs par environnement
    ├── minikube/
    │   └── gl5-student.yaml
    └── eks/
        └── gl5-student.yaml
```

## Prérequis

### Minikube (local)
- [Minikube](https://minikube.sigs.k8s.io/) avec driver `docker`
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Helm](https://helm.sh/) v3.16+
- Images Docker construites localement (`docker compose build`)

Démarrage Minikube recommandé :
```bash
minikube start --driver=docker --cpus=6 --memory=6144 --addons=ingress,metrics-server
```

> Le profil local utilise le CNI bridge par défaut de Minikube. N'ajoutez pas
> `--cni=calico` : cette option peut empêcher la création des sandboxes réseau
> sur certaines versions de Minikube/Kubernetes.

Construire les images applicatives depuis la racine du dépôt :
```bash
docker compose build \
  config-server eureka-server api-gateway \
  student-service course-service department-service enrollment-service
```

Charger les images dans le nœud Minikube :
```bash
minikube image load gl5-g4-api-gateway:local
minikube image load gl5-g4-student-service:local
minikube image load gl5-g4-course-service:local
minikube image load gl5-g4-department-service:local
minikube image load gl5-g4-enrollment-service:local
minikube image load nginx:1.27-alpine
```

Vérifier le cluster avant le déploiement :
```bash
minikube status
kubectl get nodes
kubectl get pods -A
```

### EKS (production)
- Cluster EKS avec AWS Load Balancer Controller
- External Secrets Operator installé
- IRSA configuré pour External Secrets
- Amazon RDS MySQL/PostgreSQL provisionnés
- Amazon ECR pour les images
- Secrets dans AWS Secrets Manager

## Déploiement

### 1. Mettre à jour les dépendances Helm
```bash
# Pour gl5-student
cd deploy/helm/umbrella/gl5-student
rm -rf charts && helm dependency update
```

### 2. Déployer sur Minikube

#### Namespace applicatif
```bash
cd /path/to/GL5-G4-student
helm dependency update ./deploy/helm/umbrella/gl5-student
helm upgrade --install gl5-student ./deploy/helm/umbrella/gl5-student \
  -n gl5-student --create-namespace \
  -f ./deploy/helm/values/minikube/gl5-student.yaml \
  --wait --timeout 8m
```

#### Accès
Ajouter à `/etc/hosts` (remplacer par l'IP de Minikube) :
```text
192.168.49.2 gl5-g4.test
```

Récupérer l'IP :
```bash
minikube ip
```

Accès :
- Frontend : http://gl5-g4.test/

> `.local` est réservé au mDNS sur plusieurs distributions Linux. Utilisez
> `gl5-g4.test` pour éviter `ERR_NAME_NOT_RESOLVED`.

## Tests locaux Minikube

### Vérification du déploiement

Tous les pods applicatifs et leurs endpoints doivent être prêts :
```bash
kubectl -n gl5-student get pods
kubectl -n gl5-student get svc,endpoints
kubectl -n gl5-student get ingress
helm status gl5-student -n gl5-student
```

Les déploiements attendus sont `1/1` (et `2/2` pour le frontend) :
```bash
kubectl -n gl5-student get deploy \
  -o custom-columns='NAME:.metadata.name,READY:.status.readyReplicas,DESIRED:.spec.replicas'
```

Tester l'Ingress sans dépendre du DNS :
```bash
MINIKUBE_IP="$(minikube ip)"
curl --resolve gl5-g4.test:80:"${MINIKUBE_IP}" \
  http://gl5-g4.test/
```

### Authentification de test

Le realm `gl5` est importé automatiquement par Keycloak. Les utilisateurs
Minikube sont des comptes de démonstration :

| Utilisateur | Mot de passe | Rôle |
|-------------|--------------|------|
| `admin` | `admin` | ADMIN |
| `teacher` | `teacher` | TEACHER |
| `student` | `student` | STUDENT |

Le frontend fournit une console CRUD authentifiée. Ouvrir
`http://gl5-g4.test/`, sélectionner un utilisateur, puis cliquer sur
**Sign in**.

### Tests des APIs via le frontend

La console CRUD teste les routes suivantes :

| Ressource | Liste | Création | Mise à jour | Suppression |
|-----------|-------|----------|-------------|-------------|
| Departments | `/api/department/api/departments` | `POST /api/department/api/departments` | `PUT /api/department/api/departments/{id}` | `DELETE /api/department/api/departments/{id}` |
| Courses | `/api/course/api/courses` | `POST /api/course/api/courses` | `PUT /api/course/api/courses/{id}` | `DELETE /api/course/api/courses/{id}` |
| Students | `/api/student/students/getAllStudents` | `POST /api/student/students/createStudent` | `PUT /api/student/students/updateStudent` | `DELETE /api/student/students/deleteStudent/{id}` |
| Enrollments | `/api/enrollment/Enrollment/getAllEnrollment` | `POST /api/enrollment/Enrollment/createEnrollment` | `PUT /api/enrollment/Enrollment/updateEnrollment` | `DELETE /api/enrollment/Enrollment/deleteEnrollment/{id}` |

Les appels d'écriture nécessitent le rôle `ADMIN`, sauf les créations
d'enrollment qui acceptent également `STUDENT`. Les exemples JSON sont
préremplis dans l'interface.

### Test automatisé de communication inter-services

Le scénario suivant crée un département, puis un cours et un étudiant qui le
référencent, puis un enrollment qui référence le cours et l'étudiant. Les
validations Feign entre services sont ainsi exercées :
```bash
MINIKUBE_IP="$(minikube ip)"
HOST="gl5-g4.test"
BASE="http://${HOST}"

TOKEN="$(
  curl --fail --silent --show-error \
    --resolve "${HOST}:80:${MINIKUBE_IP}" \
    -X POST "${BASE}/auth/realms/gl5/protocol/openid-connect/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data 'grant_type=password&client_id=api-gateway&username=admin&password=admin' |
  python -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'
)"

curl --fail --silent --show-error \
  --resolve "${HOST}:80:${MINIKUBE_IP}" \
  -H "Authorization: Bearer ${TOKEN}" \
  "${BASE}/api/department/api/departments"
```

Pour un diagnostic rapide d'un `401`, vérifier que la requête contient :
```text
Authorization: Bearer <access-token>
```

Un `404` sur `/department/api/departments/` signifie généralement qu'une
requête de création a envoyé un slash final vers la route d'un élément. La
création doit utiliser exactement :
```text
POST /api/department/api/departments
```

### Nettoyage local

Supprimer uniquement les releases Helm :
```bash
helm uninstall gl5-student -n gl5-student
```

Supprimer complètement le cluster Minikube de test :
```bash
minikube delete --profile=minikube
```

### 3. Déployer sur EKS

#### gl5-student
```bash
helm upgrade --install gl5-student ./deploy/helm/umbrella/gl5-student \
  -n gl5-student --create-namespace \
  -f ./deploy/helm/values/eks/gl5-student.yaml \
  --wait --timeout 10m
```

**Points importants EKS :**
- Remplacer tous les placeholders `<...>` dans `values/eks/gl5-student.yaml` (account ID, région, domaine, RDS endpoints, ARN ACM, VPC CIDR, IRSA role)
- Les bases MySQL StatefulSets sont désactivées (`enabled: false`), remplacées par des Services `ExternalName` vers RDS
- Les Secrets sont créés par External Secrets Operator depuis AWS Secrets Manager
- Pas de `imagePullSecrets` nécessaire (node role IAM)
- Ingress via AWS Load Balancer Controller (classe `alb`)

## Mise à jour et Rollback

### Mise à jour
```bash
# Mettre à jour avec de nouvelles valeurs/images
helm upgrade gl5-student ./deploy/helm/umbrella/gl5-student \
  -n gl5-student \
  -f ./deploy/helm/values/minikube/gl5-student.yaml
```

### Historique des releases
```bash
helm history gl5-student -n gl5-student
```

### Rollback
```bash
# Rollback vers la révision précédente
helm rollback gl5-student -n gl5-student

# Rollback vers une révision spécifique
helm rollback gl5-student 3 -n gl5-student
```

### Désinstallation
```bash
helm uninstall gl5-student -n gl5-student
```

**Note** : Les PVC avec `helm.sh/resource-policy: keep` (MySQL, Keycloak) ne sont pas supprimés automatiquement. Les supprimer manuellement si nécessaire.

## Sauvegarde RDS (EKS)

Pour les bases Amazon RDS en production :

### Snapshots automatiques
Configurer via AWS RDS :
- Sauvegardes automatiques activées (rétention configurable, ex. 7-30 jours)
- Fenêtre de sauvegarde en dehors des heures de pointe

### Snapshots manuels
```bash
aws rds create-db-snapshot \
  --db-instance-identifier gl5-student-db \
  --db-snapshot-identifier gl5-student-manual-$(date +%Y%m%d-%H%M%S)
```

### Restauration
```bash
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier gl5-student-db-restored \
  --db-snapshot-identifier <snapshot-id>
```

Mettre à jour les endpoints RDS dans `values/eks/gl5-student.yaml` et relancer le déploiement si nécessaire.

### Export logique (mysqldump)
Depuis un pod temporaire dans le cluster ou via bastion :
```bash
kubectl run mysql-dump -n gl5-student --rm -it --restart=Never \
  --image=mysql:8.4 -- \
  mysqldump -h <rds-endpoint> -u <user> -p<password> <database> > backup.sql
```

## Healthchecks & Probes
- **Liveness** : `/actuator/health/liveness` (Spring Boot Actuator)
- **Readiness** : `/actuator/health/readiness`
- **Startup** : `/actuator/health` (permet un démarrage plus lent)

## Autoscaling (HPA)
L'`autoscaling.enabled` peut être activé dans les valeurs des microservices. Metrics Server requis.

## NetworkPolicies
Activées par défaut. Vérification :
```bash
# Depuis un namespace externe, l'accès aux services internes doit être bloqué
kubectl run test -n default --rm -it --image=busybox:1.36 --restart=Never -- \
  wget -T 5 -O- http://student-service.gl5-student.svc.cluster.local
```

## Observabilité
Les microservices envoient les traces OTLP vers l'endpoint configuré (`OTEL_EXPORTER_OTLP_ENDPOINT`). Sur Minikube, pointer vers l'hôte Docker (`http://192.168.49.1:4318/v1/traces`).

## Dépannage

### Vérifier les pods
```bash
kubectl -n gl5-student get pods
kubectl -n gl5-student describe pod <pod-name>
kubectl -n gl5-student logs <pod-name> -c <container>
```

### Recharger les charts locaux
Après modification d'un chart dans `charts/`, relancer `helm dependency update` dans l'umbrella.

### Images non trouvées sur Minikube
```bash
minikube image load <image>:<tag>
```

### Keycloak realm non importé
Vérifier les logs : `kubectl -n gl5-student logs -l app.kubernetes.io/name=keycloak`
Le realm est importé depuis `/opt/keycloak/data/import/` via ConfigMap.

## Sécurité
- Tous les conteneurs tournent en non-root avec `seccompProfile: RuntimeDefault`
- `allowPrivilegeEscalation: false`, capabilities droppées
- ServiceAccounts sans montage automatique du token sauf si nécessaire
- NetworkPolicies restrictives
- Secrets gérés séparément par environnement (dev en clair uniquement sur Minikube jetable)
