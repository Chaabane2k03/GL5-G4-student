#Requires -Version 5.1
<#
.SYNOPSIS
    Builds, tests and submits a SonarQube analysis for every service in this repository.

.DESCRIPTION
    For each service this runs `mvn clean verify` (unit, slice and E2E tests, plus the JaCoCo
    report and coverage gate), then `sonar:sonar`, waits for the SonarQube compute engine and
    prints the quality gate of the resulting analysis.

    SonarQube is expected to run from docker-compose.sonar.yml:

        docker compose -f docker-compose.sonar.yml up -d

    A user token is required for both the scanner and the quality-gate API. Create it once in
    SonarQube (My Account > Security > Generate Token) and expose it as SONAR_TOKEN:

        $env:SONAR_TOKEN = '<token>'
        .\sonar-scan-all.ps1

    Both stacks (application and SonarQube) can run at the same time; only port 9000 is used.

.PARAMETER SonarHostUrl
    SonarQube base URL, defaults to http://localhost:9000.

.PARAMETER Token
    SonarQube user token. Defaults to the SONAR_TOKEN environment variable.

.PARAMETER Services
    Optional subset of services, e.g. -Services course-service,student-service.
    Defaults to every service in the repository.

.PARAMETER SkipQualityGate
    Do not wait for the analysis / quality gate after submitting it.

.PARAMETER FailOnQualityGate
    Exit with a non-zero code when a quality gate is not OK/WARN. By default the gate is
    reported but only build/test/analysis failures make the script fail.

.EXAMPLE
    .\sonar-scan-all.ps1

.EXAMPLE
    .\sonar-scan-all.ps1 -Services course-service

.EXAMPLE
    $env:SONAR_TOKEN = '<token>'; .\sonar-scan-all.ps1 -SonarHostUrl http://localhost:9000 -FailOnQualityGate
#>
[CmdletBinding()]
param(
    [string]$SonarHostUrl = 'http://localhost:9000',
    [string]$Token = $env:SONAR_TOKEN,
    [string[]]$Services,
    [switch]$SkipQualityGate,
    [switch]$FailOnQualityGate
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot

# Project key = directory name, so every service gets its own SonarQube project.
$serviceNames = [ordered]@{
    'config-server'      = 'Config Server'
    'eureka-server'      = 'Eureka Server'
    'department-service' = 'Department Service'
    'enrollment-service' = 'Enrollment Service'
    'course-service'     = 'Course Service'
    'student-service'    = 'Student Service'
    'api-gateway'        = 'API Gateway'
}

function Get-TestSummary {
    param([string]$ServiceDirectory)

    $summary = [pscustomobject]@{ Run = 0; Failures = 0; Errors = 0; Skipped = 0 }
    $reports = Join-Path $ServiceDirectory 'target\surefire-reports'
    if (-not (Test-Path $reports)) {
        return $summary
    }

    foreach ($file in Get-ChildItem -Path $reports -Filter 'TEST-*.xml' -File) {
        try {
            [xml]$doc = Get-Content -Path $file.FullName -Raw
        }
        catch {
            continue
        }
        if ($null -eq $doc.testsuite) {
            continue
        }
        $summary.Run += [int]$doc.testsuite.tests
        $summary.Failures += [int]$doc.testsuite.failures
        $summary.Errors += [int]$doc.testsuite.errors
        $summary.Skipped += [int]$doc.testsuite.skipped
    }
    return $summary
}

function Get-LineCoverage {
    param([string]$ServiceDirectory)

    $csv = Join-Path $ServiceDirectory 'target\site\jacoco\jacoco.csv'
    if (-not (Test-Path $csv)) {
        return 'n/a'
    }
    $rows = Import-Csv $csv
    $covered = ($rows | Measure-Object -Property LINE_COVERED -Sum).Sum
    $missed = ($rows | Measure-Object -Property LINE_MISSED -Sum).Sum
    $total = [double]$covered + [double]$missed
    if ($total -eq 0) {
        return 'n/a'
    }
    return ('{0:N1}%' -f (100 * $covered / $total))
}

function Invoke-SonarApi {
    param([string]$Path)
    return Invoke-RestMethod -Uri "$SonarHostUrl$Path" -Headers $authHeaders -TimeoutSec 30
}

function Wait-ForAnalysis {
    param([string]$TaskId)

    $deadline = (Get-Date).AddMinutes(10)
    do {
        $task = (Invoke-SonarApi "/api/ce/task?id=$TaskId").task
        if ($task.status -eq 'SUCCESS') {
            return $task.analysisId
        }
        if ($task.status -eq 'FAILED' -or $task.status -eq 'CANCELED') {
            throw "SonarQube analysis task $TaskId ended in $($task.status)."
        }
        Start-Sleep -Seconds 5
    } while ((Get-Date) -lt $deadline)

    throw "SonarQube analysis task $TaskId did not finish within 10 minutes."
}

function Get-QualityGateStatus {
    param([string]$AnalysisId)

    $gate = (Invoke-SonarApi "/api/qualitygates/project_status?analysisId=$AnalysisId").projectStatus
    foreach ($condition in $gate.conditions) {
        Write-Host ('    {0}: {1} (actual={2}, threshold={3})' -f `
                $condition.metricKey, $condition.status, $condition.actualValue, $condition.errorThreshold)
    }
    return $gate.status
}

# --------------------------------------------------------------------------- preflight ---

if (-not $Token) {
    throw @'
SONAR_TOKEN is not set. Create a token once and export it:

  1. docker compose -f docker-compose.sonar.yml up -d
  2. Open http://localhost:9000 and log in (admin / admin on first start; a password change is forced).
  3. My Account > Security > Generate Token (e.g. "local-scan").
  4. PowerShell:  $env:SONAR_TOKEN = '<token>'
     bash:        export SONAR_TOKEN='<token>'

Then re-run this script (or pass -Token '<token>').
'@
}

$maven = if ($env:OS -eq 'Windows_NT') {
    Join-Path $repoRoot 'mvnw.cmd'
}
else {
    Join-Path $repoRoot 'mvnw'
}
if (-not (Test-Path $maven)) {
    throw "Maven wrapper not found at $maven."
}

# Validate the token before spending minutes on builds.
$authHeaders = @{
    Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${Token}:"))
}
try {
    $sonarStatus = Invoke-RestMethod -Uri "$SonarHostUrl/api/system/status" -TimeoutSec 10
}
catch {
    throw "SonarQube is not reachable at $SonarHostUrl. Start it first: docker compose -f docker-compose.sonar.yml up -d"
}
if ($sonarStatus.status -ne 'UP') {
    throw "SonarQube at $SonarHostUrl reports '$($sonarStatus.status)'; wait until /api/system/status is UP."
}
if (-not (Invoke-SonarApi '/api/authentication/validate').valid) {
    throw 'The supplied SONAR_TOKEN was rejected by SonarQube. Generate a new token and try again.'
}

if ($Services) {
    $selected = @($Services)
}
else {
    $selected = @($serviceNames.Keys)
}
foreach ($name in $selected) {
    if (-not $serviceNames.Contains($name)) {
        throw "Unknown service '$name'. Known services: $($serviceNames.Keys -join ', ')."
    }
}

# -------------------------------------------------------------------------------- scan ---

$results = @()
$failedServices = @()

foreach ($name in $selected) {
    $display = $serviceNames[$name]
    $serviceDir = Join-Path $repoRoot $name
    $pom = Join-Path $serviceDir 'pom.xml'

    Write-Host ''
    Write-Host "=== $display ($name) ===" -ForegroundColor Cyan

    $result = [pscustomobject]@{
        Service  = $name
        Tests    = 'n/a'
        Failures = 'n/a'
        Coverage = 'n/a'
        Gate     = 'skipped'
    }

    if (-not (Test-Path $pom)) {
        Write-Warning "No pom.xml found in $serviceDir - skipping."
        $result.Gate = 'missing pom'
        $results += $result
        $failedServices += $name
        continue
    }

    Push-Location $serviceDir
    try {
        # Maven and the forked test JVMs write progress/warnings to stderr. In Windows
        # PowerShell a stderr line from a native command becomes an ErrorRecord, which would
        # abort the script while $ErrorActionPreference is 'Stop'. Stream both streams through
        # the pipeline instead and rely on $LASTEXITCODE for the verdict.
        $previousErrorAction = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            # Fully qualified goal: the "sonar:sonar" prefix only resolves when the pom
            # declares the plugin. Calling the coordinates directly works for every
            # service, declared or not.
            & $maven -B clean verify 'org.sonarsource.scanner.maven:sonar-maven-plugin:5.1.0.4751:sonar' `
                "-Dsonar.host.url=$SonarHostUrl" `
                "-Dsonar.token=$Token" `
                "-Dsonar.projectKey=$name" `
                "-Dsonar.projectName=$display" 2>&1 |
                ForEach-Object { Write-Host $_ }
            $buildExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousErrorAction
        }
    }
    finally {
        Pop-Location
    }

    $testSummary = Get-TestSummary -ServiceDirectory $serviceDir
    $result.Tests = $testSummary.Run
    $result.Failures = $testSummary.Failures + $testSummary.Errors
    $result.Coverage = Get-LineCoverage -ServiceDirectory $serviceDir

    if ($buildExitCode -ne 0) {
        Write-Warning "Build or analysis failed for $name (exit code $buildExitCode)."
        $result.Gate = 'build failed'
        $results += $result
        $failedServices += $name
        continue
    }

    if (-not $SkipQualityGate) {
        $reportFile = Join-Path $serviceDir 'target\sonar\report-task.txt'
        $taskLine = if (Test-Path $reportFile) {
            Select-String -Path $reportFile -Pattern '^ceTaskId=' | Select-Object -First 1
        }
        if (-not $taskLine) {
            Write-Warning "No ceTaskId in $reportFile - the analysis was not submitted."
            $result.Gate = 'no report'
            $results += $result
            $failedServices += $name
            continue
        }

        $taskId = $taskLine.Line.Substring('ceTaskId='.Length).Trim()
        try {
            $analysisId = Wait-ForAnalysis -TaskId $taskId
            $result.Gate = Get-QualityGateStatus -AnalysisId $analysisId
            if ($FailOnQualityGate -and $result.Gate -notin @('OK', 'WARN')) {
                $failedServices += $name
            }
        }
        catch {
            Write-Warning $_.Exception.Message
            $result.Gate = 'error'
            $failedServices += $name
        }
    }

    $results += $result
}

# ----------------------------------------------------------------------------- summary ---

Write-Host ''
Write-Host 'Summary' -ForegroundColor Cyan
$results | Format-Table Service, Tests, Failures, Coverage, Gate -AutoSize | Out-String | Write-Host

if ($failedServices.Count -gt 0) {
    Write-Host ("Failed: {0}" -f ($failedServices -join ', ')) -ForegroundColor Red
    exit 1
}
Write-Host 'All selected services built, tested and analysed.' -ForegroundColor Green
exit 0
