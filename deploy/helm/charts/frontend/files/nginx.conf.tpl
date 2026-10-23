{{- /*
Nginx configuration of the frontend.

The API Gateway is an internal ClusterIP Service and is never exposed
directly: every /api request is relayed to it by this frontend.

The upstream is declared in an `upstream` block, which means Nginx resolves
the Service name once, at startup. The Deployment therefore waits for the
gateway DNS to be resolvable before starting Nginx (see the init container in
deployment.yaml), otherwise Nginx would exit with "host not found in upstream"
whenever it starts before the gateway Service exists.
*/ -}}
upstream api_gateway {
    server {{ .Values.gateway.service }}:{{ .Values.gateway.port }};
    keepalive 16;
}

upstream keycloak {
    server keycloak:8080;
    keepalive 4;
}

server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # Do not advertise the Nginx version.
    server_tokens off;

    access_log /dev/stdout;
    error_log  /dev/stderr warn;

    # --- API relay -----------------------------------------------------
    # The prefix is stripped before the request is forwarded: /api/department/1
    # reaches the gateway as /department/1, the path its routes expect.
    location ^~ {{ .Values.gateway.apiPrefix }}/ {
        rewrite ^{{ .Values.gateway.apiPrefix }}/(.*)$ /$1 break;
        proxy_pass http://api_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header Connection "";
        proxy_connect_timeout 10s;
        proxy_send_timeout {{ .Values.gateway.proxyTimeoutSeconds }}s;
        proxy_read_timeout {{ .Values.gateway.proxyTimeoutSeconds }}s;
    }

    # The bare prefix, without a trailing slash.
    location = {{ .Values.gateway.apiPrefix }} {
        rewrite ^{{ .Values.gateway.apiPrefix }}$ / break;
        proxy_pass http://api_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 10s;
        proxy_read_timeout {{ .Values.gateway.proxyTimeoutSeconds }}s;
    }

    # The demo page uses the same-origin path to obtain a development token
    # without exposing the internal Keycloak Service through an Ingress.
    location ^~ /auth/ {
        proxy_pass http://keycloak/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # --- User interface ------------------------------------------------
    location / {
        try_files $uri $uri/ /index.html;
    }
}
