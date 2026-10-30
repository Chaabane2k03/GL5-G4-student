{
  "realm": "{{ .Values.realm.name }}",
  "enabled": true,
  "sslRequired": "none",
  "registrationAllowed": false,
  "loginWithEmailAllowed": true,
  "duplicateEmailsAllowed": false,
  "resetPasswordAllowed": false,
  "roles": {
    "realm": [
      { "name": "ADMIN", "description": "Full access to every resource" },
      { "name": "TEACHER", "description": "Manages the courses" },
      { "name": "STUDENT", "description": "Manages their own enrollments" }
    ]
  },
  "clients": [
    {
      "clientId": "{{ .Values.realm.clientId }}",
      "name": "GL5-G4 API Gateway",
      "description": "Public client used to obtain an access token for the API Gateway",
      "enabled": true,
      "protocol": "openid-connect",
      "publicClient": true,
      "directAccessGrantsEnabled": true,
      "standardFlowEnabled": true,
      "serviceAccountsEnabled": false,
      "redirectUris": ["*"],
      "webOrigins": ["*"],
      "attributes": {
        "post.logout.redirect.uris": "*"
      },
      "protocolMappers": [
        {
          "name": "{{ .Values.realm.clientId }}-audience",
          "protocol": "openid-connect",
          "protocolMapper": "oidc-audience-mapper",
          "consentRequired": false,
          "config": {
            "included.client.audience": "{{ .Values.realm.clientId }}",
            "id.token.claim": "false",
            "access.token.claim": "true"
          }
        }
      ]
    },
    {
      "clientId": "cursus-frontend",
      "name": "GL5-G4 Frontend",
      "description": "Browser client for the Angular frontend",
      "enabled": true,
      "protocol": "openid-connect",
      "publicClient": true,
      "directAccessGrantsEnabled": false,
      "standardFlowEnabled": true,
      "implicitFlowEnabled": false,
      "serviceAccountsEnabled": false,
      "redirectUris": ["*"],
      "webOrigins": ["*"],
      "attributes": {
        "post.logout.redirect.uris": "*"
      },
      "protocolMappers": [
        {
          "name": "api-gateway-audience",
          "protocol": "openid-connect",
          "protocolMapper": "oidc-audience-mapper",
          "consentRequired": false,
          "config": {
            "included.client.audience": "api-gateway",
            "id.token.claim": "false",
            "access.token.claim": "true"
          }
        }
      ]
    }
  ],
  "users": [
    {{- range $i, $user := .Values.realm.users }}
    {{- if $i }},{{ end }}
    {
      "username": "{{ $user.username }}",
      "enabled": true,
      "emailVerified": true,
      "firstName": "{{ $user.username }}",
      "lastName": "GL5",
      "email": "{{ $user.username }}@gl5.local",
      "credentials": [
        { "type": "password", "value": "{{ $user.password }}", "temporary": false }
      ],
      "realmRoles": [{{ range $j, $role := $user.roles }}{{ if $j }}, {{ end }}"{{ $role }}"{{ end }}]
    }
    {{- end }}
  ]
}
