[CmdletBinding()]
param(
    [string]$GatewayUrl = 'http://localhost:8072',
    [string]$KeycloakUrl = 'http://localhost:8080',
    [string]$Realm = 'gl5',
    [string]$ClientId = 'gl5-smoke',
    [string]$Username = 'admin',
    [string]$Password = 'admin'
)

$ErrorActionPreference = 'Stop'

$script:ApiBase = $GatewayUrl.TrimEnd('/')
$script:Token = $null

function Get-AccessToken {
    $tokenUri = '{0}/realms/{1}/protocol/openid-connect/token' -f $KeycloakUrl.TrimEnd('/'), $Realm
    $body = @{
        grant_type = 'password'
        client_id  = $ClientId
        username   = $Username
        password   = $Password
    }

    try {
        $response = Invoke-RestMethod -Method Post -Uri $tokenUri -Body $body -ContentType 'application/x-www-form-urlencoded'
    }
    catch {
        throw "Unable to obtain a Keycloak token from $tokenUri. Is Keycloak running? $($_.Exception.Message)"
    }

    if (-not $response.access_token) {
        throw "Keycloak returned no access_token for client '$ClientId'."
    }

    return $response.access_token
}

function Invoke-CursusApi {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        $Body = $null
    )

    $uri = '{0}{1}' -f $script:ApiBase, $Path
    $headers = @{ Authorization = "Bearer $script:Token" }
    $attempt = 0

    while ($true) {
        $attempt++
        try {
            $request = @{
                Method      = $Method
                Uri         = $uri
                Headers     = $headers
                ContentType = 'application/json'
            }
            if ($null -ne $Body) {
                $request.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
            }
            return Invoke-RestMethod @request
        }
        catch {
            $status = 0
            if ($_.Exception.Response) {
                $status = [int]$_.Exception.Response.StatusCode
            }

            if (($status -eq 429 -or $status -eq 503 -or $status -eq 504) -and $attempt -lt 4) {
                Start-Sleep -Seconds 1
                continue
            }

            $detail = $_.Exception.Message
            if ($_.Exception.Response) {
                try {
                    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                    $detail = $reader.ReadToEnd()
                    $reader.Dispose()
                }
                catch {
                    # Keep the original exception message when the body cannot be read.
                }
            }

            throw "HTTP $status on $Method $uri : $detail"
        }
    }
}

function Add-Sleep {
    Start-Sleep -Milliseconds 120
}

function Get-Items {
    param([string]$Path)

    $result = Invoke-CursusApi -Method Get -Path $Path
    return @($result)
}

$script:Token = Get-AccessToken
Write-Host 'Authenticated against Keycloak.'

$departmentSeeds = @(
    @{ name = 'Informatique'; location = 'Batiment A'; phone = '71000001'; head = 'Dr. Amine Ben Salah' },
    @{ name = 'Mathematiques'; location = 'Batiment B'; phone = '71000002'; head = 'Dr. Leila Trabelsi' }
)

$courseSeeds = @(
    @{ code = 'INF101'; title = 'Introduction a l informatique'; description = 'Fondations des systemes et de la programmation'; credits = 6; department = 'Informatique' },
    @{ code = 'INF201'; title = 'Structures de donnees'; description = 'Algorithmes, listes, arbres et graphes'; credits = 6; department = 'Informatique' },
    @{ code = 'MAT101'; title = 'Analyse mathematique'; description = 'Calcul differentiel et integral'; credits = 4; department = 'Mathematiques' }
)

$studentSeeds = @(
    @{ firstName = 'Ali'; lastName = 'Ben Salah'; email = 'ali.ben.salah@cursus.local'; phone = '21000001'; dateOfBirth = '2000-01-12'; address = 'Tunis'; department = 'Informatique' },
    @{ firstName = 'Sara'; lastName = 'Khaled'; email = 'sara.khaled@cursus.local'; phone = '21000002'; dateOfBirth = '2001-05-10'; address = 'Sfax'; department = 'Informatique' },
    @{ firstName = 'Mohamed'; lastName = 'Trabelsi'; email = 'mohamed.trabelsi@cursus.local'; phone = '21000003'; dateOfBirth = '2000-09-20'; address = 'Sousse'; department = 'Mathematiques' },
    @{ firstName = 'Nadia'; lastName = 'Mansour'; email = 'nadia.mansour@cursus.local'; phone = '21000004'; dateOfBirth = '2001-12-15'; address = 'Gabes'; department = 'Mathematiques' }
)

$enrollmentSeeds = @(
    @{ studentEmail = 'ali.ben.salah@cursus.local'; code = 'INF101'; status = 'ACTIVE'; grade = $null; date = '2025-09-01' },
    @{ studentEmail = 'ali.ben.salah@cursus.local'; code = 'INF201'; status = 'COMPLETED'; grade = 15.5; date = '2025-09-01' },
    @{ studentEmail = 'sara.khaled@cursus.local'; code = 'INF101'; status = 'ACTIVE'; grade = $null; date = '2025-09-01' },
    @{ studentEmail = 'mohamed.trabelsi@cursus.local'; code = 'MAT101'; status = 'DROPPED'; grade = $null; date = '2025-09-01' }
)

$existingDepartments = Get-Items -Path '/department/api/departments'
$departmentByName = @{}
foreach ($department in $existingDepartments) {
    if ($department.name) {
        $departmentByName[$department.name] = $department
    }
}

foreach ($seed in $departmentSeeds) {
    if ($departmentByName.ContainsKey($seed.name)) {
        Write-Host ("Department already present: {0}" -f $seed.name)
        continue
    }

    $created = Invoke-CursusApi -Method Post -Path '/department/api/departments' -Body @{
        name     = $seed.name
        location = $seed.location
        phone    = $seed.phone
        head     = $seed.head
    }
    $departmentByName[$seed.name] = $created
    Write-Host ("Created department {0} (id {1})" -f $seed.name, $created.idDepartment)
    Add-Sleep
}

$existingCourses = Get-Items -Path '/course/api/courses?page=0&size=100&sort=code,asc'
$courseByCode = @{}
foreach ($course in $existingCourses) {
    if ($course.content) {
        foreach ($item in @($course.content)) {
            $courseByCode[$item.code.ToUpperInvariant()] = $item
        }
    }
    elseif ($course.code) {
        $courseByCode[$course.code.ToUpperInvariant()] = $course
    }
}

foreach ($seed in $courseSeeds) {
    $code = $seed.code.ToUpperInvariant()
    if ($courseByCode.ContainsKey($code)) {
        Write-Host ("Course already present: {0}" -f $code)
        continue
    }

    $department = $departmentByName[$seed.department]
    if (-not $department) {
        throw "Department '$($seed.department)' is missing; cannot create course $code."
    }

    $created = Invoke-CursusApi -Method Post -Path '/course/api/courses' -Body @{
        code         = $code
        title        = $seed.title
        description  = $seed.description
        credits      = $seed.credits
        departmentId = $department.idDepartment
    }
    $courseByCode[$code] = $created
    Write-Host ("Created course {0} (id {1})" -f $code, $created.id)
    Add-Sleep
}

$existingStudents = Get-Items -Path '/student/students/getAllStudents'
$studentByEmail = @{}
foreach ($student in $existingStudents) {
    if ($student.email) {
        $studentByEmail[$student.email.ToLowerInvariant()] = $student
    }
}

foreach ($seed in $studentSeeds) {
    $email = $seed.email.ToLowerInvariant()
    if ($studentByEmail.ContainsKey($email)) {
        Write-Host ("Student already present: {0}" -f $email)
        continue
    }

    $department = $departmentByName[$seed.department]
    if (-not $department) {
        throw "Department '$($seed.department)' is missing; cannot create student $email."
    }

    $created = Invoke-CursusApi -Method Post -Path '/student/students/createStudent' -Body @{
        firstName    = $seed.firstName
        lastName     = $seed.lastName
        email        = $seed.email
        phone        = $seed.phone
        dateOfBirth  = $seed.dateOfBirth
        address      = $seed.address
        departmentId = $department.idDepartment
    }
    $studentByEmail[$email] = $created
    Write-Host ("Created student {0} (id {1})" -f $email, $created.idStudent)
    Add-Sleep
}

$existingEnrollments = Get-Items -Path '/enrollment/Enrollment/getAllEnrollment'
$enrollmentKeys = @{}
foreach ($enrollment in $existingEnrollments) {
    $key = '{0}|{1}' -f $enrollment.studentId, $enrollment.courseId
    $enrollmentKeys[$key] = $true
}

foreach ($seed in $enrollmentSeeds) {
    $student = $studentByEmail[$seed.studentEmail.ToLowerInvariant()]
    $course = $courseByCode[$seed.code.ToUpperInvariant()]

    if (-not $student) {
        throw "Student '$($seed.studentEmail)' is missing; cannot create enrollment."
    }
    if (-not $course) {
        throw "Course '$($seed.code)' is missing; cannot create enrollment."
    }

    $key = '{0}|{1}' -f $student.idStudent, $course.id
    if ($enrollmentKeys.ContainsKey($key)) {
        Write-Host ("Enrollment already present: student {0}, course {1}" -f $student.idStudent, $course.id)
        continue
    }

    $createdId = Invoke-CursusApi -Method Post -Path '/enrollment/Enrollment/createEnrollment' -Body @{
        enrollmentDate = $seed.date
        grade          = $seed.grade
        status         = $seed.status
        studentId      = $student.idStudent
        courseId       = $course.id
    }
    $enrollmentKeys[$key] = $true
    Write-Host ("Created enrollment id {0} for student {1}, course {2}" -f $createdId, $student.idStudent, $course.id)
    Add-Sleep
}

$departments = Get-Items -Path '/department/api/departments'
$courses = Get-Items -Path '/course/api/courses?page=0&size=100&sort=code,asc'
$students = Get-Items -Path '/student/students/getAllStudents'
$enrollments = Get-Items -Path '/enrollment/Enrollment/getAllEnrollment'

$courseCount = 0
foreach ($page in $courses) {
    if ($page.content) {
        $courseCount += @($page.content).Count
    }
    elseif ($page.code) {
        $courseCount++
    }
}

Write-Host ''
Write-Host 'Seed summary'
Write-Host ("  Departments: {0}" -f $departments.Count)
Write-Host ("  Courses:     {0}" -f $courseCount)
Write-Host ("  Students:    {0}" -f $students.Count)
Write-Host ("  Enrollments: {0}" -f $enrollments.Count)
Write-Host 'Done. Open http://localhost:4200 and sign in with admin/admin.'
