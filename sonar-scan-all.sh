#!/usr/bin/env bash
# Build, test, scan and report coverage for every service in this repository.
#
# Usage:
#   ./sonar-scan-all.sh                 # all services
#   ./sonar-scan-all.sh course-service  # subset
#
# SONAR_TOKEN is read from the environment or from the root .env file.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="${SONAR_HOST_URL:-http://localhost:9000}"
LOG_DIR="$ROOT/.sonar-logs"
PROJECT_VERSION="${PROJECT_VERSION:-1.0.0}"
MVNW="$ROOT/mvnw"

mkdir -p "$LOG_DIR"

die() { echo "ERROR: $*" >&2; exit 1; }

# --------------------------------------------------------------------------- config ---

TOKEN="${SONAR_TOKEN:-}"
if [[ -z "$TOKEN" && -f "$ROOT/.env" ]]; then
    line="$(grep -m1 '^[[:space:]]*SONAR_TOKEN[[:space:]]*=' "$ROOT/.env" || true)"
    if [[ -n "$line" ]]; then
        TOKEN="${line#*=}"
        TOKEN="${TOKEN%\"}"; TOKEN="${TOKEN#\"}"
        TOKEN="${TOKEN%\'}"; TOKEN="${TOKEN#\'}"
        TOKEN="$(printf '%s' "$TOKEN" | tr -d '\r' | xargs)"
    fi
fi
[[ -n "$TOKEN" ]] || die "SONAR_TOKEN is not set (put it in $ROOT/.env or export it)."

if [[ -x "$MVNW" ]]; then
    MVN_CMD=("$MVNW")
elif command -v mvn >/dev/null 2>&1; then
    MVN_CMD=(mvn)
else
    die "Maven wrapper and mvn are both unavailable."
fi

SCANNER_BIN="${SONAR_SCANNER_BIN:-}"
if [[ -z "$SCANNER_BIN" ]] && command -v sonar-scanner >/dev/null 2>&1; then
    SCANNER_BIN="$(command -v sonar-scanner)"
fi
if [[ -z "$SCANNER_BIN" ]]; then
    SCANNER_BIN="$(find /tmp/opencode/sonar-scanner -maxdepth 3 -type f -name sonar-scanner -perm -u+x 2>/dev/null | head -1 || true)"
fi

api() { curl -fsS -u "$TOKEN:" "$HOST$1"; }

# ------------------------------------------------------------------------- helpers ---

load_env_file() {
    local file="$1" line key val
    [[ -f "$file" ]] || return 0
    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line%$'\r'}"
        [[ -z "${line//[[:space:]]/}" || "$line" == \#* ]] && continue
        [[ "$line" == *=* ]] || continue
        key="${line%%=*}"; val="${line#*=}"
        key="$(printf '%s' "$key" | xargs)"
        [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
        val="${val%\"}"; val="${val#\"}"
        val="${val%\'}"; val="${val#\'}"
        export "$key=$val"
    done < "$file"
}

run_logged() {
    local log="$1"; shift
    "$@" 2>&1 | tee -a "$log"
    return "${PIPESTATUS[0]}"
}

jacoco_coverage() {
    local csv="$1" out lc bc
    [[ -f "$csv" ]] || { printf 'n/a\tn/a\n'; return; }
    out="$(awk -F, '
        NR > 1 { lm += $8; lc += $9; bm += $6; bc += $7 }
        END {
            line   = (lm + lc > 0) ? sprintf("%.1f%%", 100 * lc / (lm + lc)) : "n/a"
            branch = (bm + bc > 0) ? sprintf("%.1f%%", 100 * bc / (bm + bc)) : "n/a"
            print line "\t" branch
        }' "$csv")"
    printf '%s\n' "$out"
}

lcov_coverage() {
    local lcov="$1"
    [[ -f "$lcov" ]] || { printf 'n/a\tn/a\n'; return; }
    awk -F: '
        /^LF:/ { lf += $2 }
        /^LH:/ { lh += $2 }
        /^BRF:/ { brf += $2 }
        /^BRH:/ { brh += $2 }
        END {
            line   = (lf > 0) ? sprintf("%.1f%%", 100 * lh / lf) : "n/a"
            branch = (brf > 0) ? sprintf("%.1f%%", 100 * brh / brf) : "n/a"
            print line "\t" branch
        }' "$lcov"
}

surefire_summary() {
    local dir="$1"
    python3 - "$dir" <<'PY'
import glob, sys, xml.etree.ElementTree as ET
tests = failures = skipped = 0
for path in glob.glob(sys.argv[1] + "/TEST-*.xml"):
    try:
        root = ET.parse(path).getroot()
    except Exception:
        continue
    tests += int(root.get("tests", 0))
    failures += int(root.get("failures", 0)) + int(root.get("errors", 0))
    skipped += int(root.get("skipped", 0))
print(f"{tests}|{failures}|{skipped}")
PY
}

junit_summary() {
    local file="$1"
    [[ -f "$file" ]] || { printf '0|0|0\n'; return; }
    python3 - "$file" <<'PY'
import sys, xml.etree.ElementTree as ET
try:
    root = ET.parse(sys.argv[1]).getroot()
    suites = [root] if root.tag == "testsuite" else list(root.iter("testsuite"))
    tests = sum(int(s.get("tests", 0)) for s in suites)
    failures = sum(int(s.get("failures", 0)) + int(s.get("errors", 0)) for s in suites)
    skipped = sum(int(s.get("skipped", 0)) for s in suites)
    print(f"{tests}|{failures}|{skipped}")
except Exception:
    print("0|0|0")
PY
}

measure() {
    local metric="$1" json="$2"
    jq -r --arg m "$metric" '.component.measures[]? | select(.metric == $m) | .value' \
        <<< "$json" | head -1
}

# ------------------------------------------------------------------------ preflight ---

status_json="$(curl -fsS "$HOST/api/system/status" 2>/dev/null || true)"
[[ -n "$status_json" ]] || die "SonarQube is not reachable at $HOST."
status="$(jq -r '.status // "UNKNOWN"' <<< "$status_json")"
[[ "$status" == "UP" ]] || die "SonarQube reports '$status', expected UP."

auth_json="$(api '/api/authentication/validate' 2>/dev/null || true)"
[[ "$(jq -r '.valid // false' <<< "$auth_json")" == "true" ]] || die "SONAR_TOKEN was rejected by SonarQube."

echo "SonarQube $HOST is $status; token is valid."
[[ -n "$SCANNER_BIN" ]] || echo "NOTE: sonar-scanner CLI not found; the frontend cannot be scanned." >&2

# -------------------------------------------------------------------------- services ---

KEYS=(config-server eureka-server department-service enrollment-service course-service student-service api-gateway)
NAMES=("Config Server" "Eureka Server" "Department Service" "Enrollment Service" "Course Service" "Student Service" "API Gateway")

if [[ $# -gt 0 ]]; then
    requested=("$@")
else
    requested=("${KEYS[@]}" frontend-service)
fi

RESULTS=()
FAILED=()

for key in "${requested[@]}"; do
    display="$key"
    for i in "${!KEYS[@]}"; do
        if [[ "${KEYS[$i]}" == "$key" ]]; then display="${NAMES[$i]}"; fi
    done
    [[ "$key" == "frontend-service" ]] && display="Cursus Frontend"

    echo
    echo "=== $display ($key) ==="

    if [[ "$key" == "frontend-service" ]]; then
        svc_dir="$ROOT/frontend-service"
        log="$LOG_DIR/frontend-service.log"
        : > "$log"
        load_env_file "$svc_dir/.env"

        chrome="${CHROME_BIN:-}"
        if [[ -z "$chrome" && -x /opt/google/chrome/chrome ]]; then
            chrome=/opt/google/chrome/chrome
        fi
        [[ -n "$chrome" ]] && export CHROME_BIN="$chrome"

        build_rc=0
        run_logged "$log" npm --prefix "$svc_dir" run test:ci || build_rc=$?
        if [[ $build_rc -eq 0 ]]; then
            run_logged "$log" npm --prefix "$svc_dir" run coverage:normalize || build_rc=$?
        fi
        if [[ $build_rc -eq 0 ]]; then
            run_logged "$log" npm --prefix "$svc_dir" run build || build_rc=$?
        fi

        scan_rc=1
        if [[ -n "$SCANNER_BIN" ]]; then
            scan_rc=0
            (cd "$svc_dir" && run_logged "$log" "$SCANNER_BIN" \
                -Dsonar.host.url="$HOST" \
                -Dsonar.token="$TOKEN" \
                -Dsonar.projectKey=cursus-frontend \
                -Dsonar.projectName="Cursus Frontend" \
                -Dsonar.projectVersion="$PROJECT_VERSION" \
                -Dsonar.working.directory=.scannerwork) || scan_rc=$?
        fi

        read -r tests failures skipped <<< "$(junit_summary "$svc_dir/coverage/junit.xml" | tr '|' ' ')"
        read -r line_cov branch_cov <<< "$(lcov_coverage "$svc_dir/coverage/cursus-frontend/lcov.info")"
        rc=$build_rc
        [[ $scan_rc -ne 0 ]] && rc=$scan_rc
    else
        svc_dir="$ROOT/$key"
        log="$LOG_DIR/$key.log"
        : > "$log"
        [[ -f "$svc_dir/pom.xml" ]] || { echo "  no pom.xml - skipping"; FAILED+=("$key"); continue; }
        load_env_file "$svc_dir/ci.env"
        [[ -f "$svc_dir/.env" ]] && load_env_file "$svc_dir/.env"

        echo "  running tests + JaCoCo..."
        verify_rc=0
        (cd "$svc_dir" && run_logged "$log" "${MVN_CMD[@]}" -B clean verify) || verify_rc=$?

        echo "  submitting SonarQube analysis..."
        scan_rc=0
        (cd "$svc_dir" && run_logged "$log" "${MVN_CMD[@]}" -B \
            org.sonarsource.scanner.maven:sonar-maven-plugin:5.1.0.4751:sonar \
            -Dsonar.host.url="$HOST" \
            -Dsonar.token="$TOKEN" \
            -Dsonar.projectKey="$key" \
            -Dsonar.projectName="$display" \
            -Dsonar.projectVersion="$PROJECT_VERSION" \
            -Dsonar.coverage.jacoco.xmlReportPaths="$svc_dir/target/site/jacoco/jacoco.xml") || scan_rc=$?

        read -r tests failures skipped <<< "$(surefire_summary "$svc_dir/target/surefire-reports" | tr '|' ' ')"
        read -r line_cov branch_cov <<< "$(jacoco_coverage "$svc_dir/target/site/jacoco/jacoco.csv")"
        rc=$verify_rc
        [[ $scan_rc -ne 0 ]] && rc=$scan_rc
    fi

    # ------------------------------------------------------------ gate + Sonar metrics ---
    sonar_key="$key"
    [[ "$key" == "frontend-service" ]] && sonar_key="cursus-frontend"
    gate="not submitted"
    when_success=""
    report=""
    if [[ "$key" == "frontend-service" ]]; then
        report="$svc_dir/.scannerwork/report-task.txt"
    else
        report="$svc_dir/target/sonar/report-task.txt"
    fi

    if [[ -f "$report" ]]; then
        task_id="$(sed -n 's/^ceTaskId=//p' "$report" | head -1 | tr -d '\r')"
        if [[ -n "$task_id" ]]; then
            for _ in $(seq 1 120); do
                task_json="$(api "/api/ce/task?id=$task_id" 2>/dev/null || true)"
                task_status="$(jq -r '.task.status // "UNKNOWN"' <<< "$task_json")"
                if [[ "$task_status" == "SUCCESS" ]]; then
                    when_success="$(jq -r '.task.analysisId // empty' <<< "$task_json")"
                    break
                fi
                if [[ "$task_status" == "FAILED" || "$task_status" == "CANCELED" ]]; then
                    gate="$task_status"
                    break
                fi
                sleep 5
            done

            if [[ -n "$when_success" ]]; then
                gate_json="$(api "/api/qualitygates/project_status?analysisId=$when_success" 2>/dev/null || true)"
                gate="$(jq -r '.projectStatus.status // "unknown"' <<< "$gate_json")"
                jq -r '.projectStatus.conditions[]? | "    \(.metricKey): \(.status) (actual=\(.actualValue), threshold=\(.errorThreshold))"' \
                    <<< "$gate_json" | tee -a "$log"
            fi
        fi
    fi

    measures="$(api "/api/measures/component?component=$sonar_key&metricKeys=coverage,lines_to_cover,uncovered_lines,branch_coverage,tests" 2>/dev/null || true)"
    sonar_cov="$(measure coverage "$measures")"
    [[ -n "$sonar_cov" ]] || sonar_cov="n/a"

    build_status="OK"
    if [[ $rc -ne 0 ]]; then
        if grep -q 'Coverage checks have not been met' "$log"; then
            build_status="coverage gate failed"
        elif [[ $scan_rc -ne 0 ]]; then
            build_status="scan failed"
        else
            build_status="tests/build failed"
        fi
        FAILED+=("$key")
    elif [[ "$gate" == "ERROR" || "$gate" == "FAILED" || "$gate" == "CANCELED" || "$gate" == "unknown" ]]; then
        FAILED+=("$key")
    fi

    RESULTS+=("$key|$display|$tests|$failures|$line_cov|$branch_cov|$sonar_cov|$build_status|$gate")
    printf '  tests=%s failures=%s coverage=%s branches=%s sonar=%s gate=%s\n' \
        "$tests" "$failures" "$line_cov" "$branch_cov" "$sonar_cov" "$gate"
done

# ----------------------------------------------------------------------------- report ---

REPORT="$ROOT/coverage-report.md"
{
    echo "# Coverage analysis"
    echo
    echo "- SonarQube: $HOST"
    echo "- Generated: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    echo "- Logs: \`.sonar-logs/\`"
    echo
    echo "| Service | Tests | Failures | Line cov. | Branch cov. | Sonar cov. | Build | Quality gate |"
    echo "|---|---:|---:|---:|---:|---:|---|---|"
    for row in "${RESULTS[@]}"; do
        IFS='|' read -r key display tests failures line_cov branch_cov sonar_cov build_status gate <<< "$row"
        link_key="$key"
        [[ "$key" == "frontend-service" ]] && link_key="cursus-frontend"
        printf '| [%s](%s/dashboard?id=%s) | %s | %s | %s | %s | %s | %s | %s |\n' \
            "$display" "$HOST" "$link_key" "$tests" "$failures" "$line_cov" "$branch_cov" "$sonar_cov" "$build_status" "$gate"
    done
    echo
    if [[ ${#FAILED[@]} -gt 0 ]]; then
        echo "Failed services: ${FAILED[*]}"
    else
        echo "All selected services were built, tested and analysed successfully."
    fi
} > "$REPORT"

echo
echo "Summary"
printf '%-20s %6s %6s %8s %8s %8s %-20s %s\n' SERVICE TESTS FAIL LINE BRANCH SONAR BUILD GATE
for row in "${RESULTS[@]}"; do
    IFS='|' read -r key display tests failures line_cov branch_cov sonar_cov build_status gate <<< "$row"
    printf '%-20s %6s %6s %8s %8s %8s %-20s %s\n' "$key" "$tests" "$failures" "$line_cov" "$branch_cov" "$sonar_cov" "$build_status" "$gate"
done
echo
echo "Report written to $REPORT"

[[ ${#FAILED[@]} -eq 0 ]]
