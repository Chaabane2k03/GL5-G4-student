# Cursus — Frontend Angular

Interface web de gestion académique (étudiants, départements, cours, inscriptions) pour la
plateforme **GL5-G4**. L'application est une SPA Angular qui consomme exclusivement l'**API
Gateway** (port `8072`) et délègue l'authentification à **Keycloak** (realm `gl5`, client
public `cursus-frontend`, PKCE S256).

## Stack

| Élément | Version |
| --- | --- |
| Angular | 22.2 |
| TypeScript | 6.0 |
| Node.js | 24 (LTS) |
| Keycloak JS | 26.x |
| Keycloak | 26.8.1 |
| Serveur statique | nginx 1.29 (image Alpine) |

## Structure

```text
src/app/
├── api/          # Clients HTTP + DTO + mappers par microservice
├── core/         # auth, config runtime, intercepteurs, erreurs, utilitaires
├── domain/       # Modèles métier
├── features/     # Écrans (dashboard, étudiants, cours, départements, inscriptions, erreurs)
├── layout/       # Shell applicatif (en-tête, navigation)
└── shared/       # Composants UI réutilisables, pipes
src/test/         # Tests unitaires Angular et leurs helpers
docker/           # nginx.conf + template config.json (envsubst)
keycloak/         # Realm gl5 + thème de connexion Cursus
public/           # Favicon + config.json de développement
scripts/          # Scripts utilitaires (données de démonstration)
```

## Démarrage complet recommandé

Le frontend et Keycloak font partie de la stack racine `gl5-g4-student`. Depuis la racine
du dépôt :

```powershell
docker compose up -d --build
```

- Frontend : `http://localhost:4200`
- Keycloak : `http://localhost:8081`
- API Gateway : `http://localhost:8072`

Conteneurs associés :

| Service Compose | Conteneur | Image |
| --- | --- | --- |
| `frontend-service` | `gl5-frontend-service` | `gl5-g4-frontend-service:local` |
| `keycloak-service` | `gl5-keycloak-service` | `quay.io/keycloak/keycloak:26.8.1` |

Un fichier `.env` à la racine est **facultatif** : les valeurs par défaut de
`docker-compose.yml` suffisent. Pour personnaliser les ports, les URLs ou l'administrateur
Keycloak local, copier `.env.example` vers `.env`. Ce fichier est ignoré par Git ; ne jamais
y placer de secret réel.

## Configuration runtime

Au démarrage, `ConfigService` charge `/config.json` (aucune valeur codée en dur dans le
bundle). En développement, `public/config.json` est servi tel quel. En conteneur, le fichier
est généré depuis `docker/config.json.template` via `envsubst`.

| Variable | Description | Défaut |
| --- | --- | --- |
| `API_BASE_URL` | URL de l'API Gateway (navigateur) | `http://localhost:8072` |
| `KEYCLOAK_URL` | URL publique du serveur Keycloak | `http://localhost:8081` |
| `KEYCLOAK_REALM` | Realm Keycloak | `gl5` |
| `KEYCLOAK_CLIENT_ID` | Client public Keycloak | `cursus-frontend` |
| `FRONTEND_PORT` | Port hôte du conteneur frontend | `4200` |
| `KEYCLOAK_PORT` | Port hôte du conteneur Keycloak | `8081` |
| `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` | Admin bootstrap du realm `master` | `admin` / `admin` |

Ces variables sont **publiques** : elles finissent dans le navigateur. Ne jamais y placer de
secret.

## Keycloak et thème

- Console d'administration : `http://localhost:8080` (`admin` / `admin`)
- Realm `gl5` importé automatiquement au démarrage
- Utilisateur applicatif de test : `admin` / `admin` (rôle `ADMIN`)
- Client SPA : `cursus-frontend` (PKCE S256)
- Client de test : `gl5-smoke` (grant mot de passe, réservé aux scripts locaux)
- Thème de connexion : `cursus`

Le thème est appliqué par **Keycloak**, pas par Angular. Les fichiers se trouvent dans
`frontend-service/keycloak/themes/cursus` et le realm active `loginTheme: cursus`. Dans la
stack racine, ce dossier est monté dans `gl5-keycloak-service` sur
`/opt/keycloak/themes`. nginx ne sert que la SPA Angular.

Après une modification du realm ou du thème, recréer Keycloak :

```powershell
docker compose up -d --force-recreate keycloak-service
```

## Intégration avec l'API Gateway

La stack racine configure déjà le gateway. Les valeurs utilisées sont :

```yaml
KEYCLOAK_ISSUER_URI: http://localhost:8080/realms/gl5
JWK_SET_URI: http://keycloak-service:8080/realms/gl5/protocol/openid-connect/certs
```

- `KEYCLOAK_ISSUER_URI` doit correspondre au claim `iss` du jeton, vu par le navigateur.
- `JWK_SET_URI` doit être joignable **depuis le conteneur** gateway. Le nom
  `keycloak-service` est le nom DNS du service Compose, pas `localhost`.
- Utiliser `http://localhost:8080` dans le navigateur, et non `127.0.0.1`, pour rester
  cohérent avec l'émetteur configuré.
- La gateway autorise toutes les origines en développement (`gateway.cors.allowed-origins=*`).
  Les contrôleurs backend ne doivent pas ajouter de `@CrossOrigin` : sinon l'en-tête CORS est
  dupliqué.

## Développement Angular sans conteneur frontend

Prérequis : Node 24, npm 11, Chrome (tests) et la stack backend démarrée (gateway sur
`http://localhost:8072` et Keycloak sur `http://localhost:8080`).

```powershell
npm ci
npm start
```

Le serveur de développement écoute sur `http://localhost:4200`. Pour pointer vers un autre
backend, modifier `public/config.json`.

## Données de démonstration

Une fois Keycloak et la stack backend prêts, depuis la racine du dépôt :

```powershell
npm --prefix frontend-service run seed
```

Le script utilise le client `gl5-smoke` pour obtenir un jeton `ADMIN`, puis crée 2
départements, 3 cours, 4 étudiants et 4 inscriptions. Il est idempotent.

## Endpoints consommés

| Service | Route via la gateway |
| --- | --- |
| Départements | `/department/api/departments` |
| Cours | `/course/api/courses` |
| Étudiants | `/student/students/getAllStudents` |
| Inscriptions | `/enrollment/Enrollment/getAllEnrollment` |

Les requêtes vers la gateway portent le jeton `Authorization: Bearer`. Les erreurs HTTP sont
normalisées (401 session expirée, 403 vers `/403`, 404 page dédiée, messages 429 / 503).

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm start` / `npm run dev` | Serveur de développement (`:4200`) |
| `npm run build` | Build de production dans `dist/cursus-frontend` |
| `npm test` | Tests unitaires Karma/Jasmine (ChromeHeadless) |
| `npm run lint` | ESLint (TypeScript + templates Angular) |
| `npm run format` | Prettier |
| `npm run seed` | Données de démonstration via l'API Gateway |

## Vérifications

```powershell
npm run lint
npm test
npm run build
npm audit
```

Les scénarios E2E Playwright sont conservés localement, hors dépôt. Ils vérifient le thème,
la connexion, l'erreur de mot de passe, les compteurs du tableau de bord, l'absence de
fragment OIDC dans l'URL, le CORS et un CRUD de département avec nettoyage.
