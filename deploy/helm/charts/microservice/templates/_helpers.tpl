{{/*
Chart name, overridable.
*/}}
{{- define "microservice.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Fully qualified object name. This is the Kubernetes Service DNS name used by
the other components (gateway routes, frontend proxy_pass, JDBC URLs), so it
is normally pinned with `fullnameOverride`.
*/}}
{{- define "microservice.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "microservice.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Labels shared by every object of the release.
*/}}
{{- define "microservice.labels" -}}
helm.sh/chart: {{ include "microservice.chart" . }}
{{ include "microservice.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: {{ .Values.partOf }}
app.kubernetes.io/component: {{ .Values.component }}
{{- end }}

{{/*
Selector labels: must stay stable across upgrades, they identify the pods of
this instance in the NetworkPolicies and in the Service selectors.
*/}}
{{- define "microservice.selectorLabels" -}}
app.kubernetes.io/name: {{ include "microservice.fullname" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "microservice.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "microservice.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{- define "microservice.configMapName" -}}
{{- if .Values.configMap.existing }}
{{- .Values.configMap.existing }}
{{- else }}
{{- printf "%s-config" (include "microservice.fullname" .) }}
{{- end }}
{{- end }}

{{- define "microservice.secretName" -}}
{{- if .Values.secret.existing }}
{{- .Values.secret.existing }}
{{- else }}
{{- printf "%s-secret" (include "microservice.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Absolute Actuator path of a probe: the management endpoints live under the
servlet context path of the service (/student/actuator/health/liveness).
*/}}
{{- define "microservice.probePath" -}}
{{- $ctx := .ctx -}}
{{- $path := .path -}}
{{- if $ctx }}{{ printf "%s%s" $ctx $path }}{{ else }}{{ $path }}{{ end }}
{{- end }}
