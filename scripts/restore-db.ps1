Param(
  [string]$SqlFile = $(throw "SqlFile parameter required"),
  [string]$DbName = $Env:DB_NAME -or 'heavy_machine'
)

if (-not (Test-Path $SqlFile)) { Write-Error "Sql file not found: $SqlFile"; exit 1 }

$dbHost = $Env:DB_HOST -or '127.0.0.1'
$dbPort = $Env:DB_PORT -or '3306'
$dbUser = $Env:DB_USER -or 'root'
$dbPass = $Env:DB_PASSWORD -or ''

$passwordArg = if ($dbPass -ne '') { "-p$dbPass" } else { "" }

Write-Host "Restoring $SqlFile into database $DbName"

$cmd = "mysql -h $dbHost -P $dbPort -u $dbUser $passwordArg $DbName < `"$SqlFile`""
Write-Host "Running: $cmd"
Invoke-Expression $cmd

if ($LASTEXITCODE -eq 0) { Write-Host "Restore completed" } else { Write-Error "mysql restore failed with exit code $LASTEXITCODE"; exit $LASTEXITCODE }
