Param(
  [string]$OutDir = "backups",
  [string]$DumpFile = $("backup-$(Get-Date -Format yyyyMMdd-HHmmss).sql")
)

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

$dbHost = $Env:DB_HOST -or '127.0.0.1'
$dbPort = $Env:DB_PORT -or '3306'
$dbUser = $Env:DB_USER -or 'root'
$dbPass = $Env:DB_PASSWORD -or ''
$dbName = $Env:DB_NAME -or 'heavy_machine'

$outPath = Join-Path $OutDir $DumpFile

Write-Host "Creating backup of database '$dbName' to $outPath"

$passwordArg = if ($dbPass -ne '') { "-p$dbPass" } else { "" }

# Use --single-transaction for consistent snapshot
$cmd = "mysqldump -h $dbHost -P $dbPort -u $dbUser $passwordArg --single-transaction --routines --triggers $dbName > `"$outPath`""

Write-Host "Running: $cmd"
Invoke-Expression $cmd

if ($LASTEXITCODE -eq 0) { Write-Host "Backup created: $outPath" } else { Write-Error "mysqldump failed with exit code $LASTEXITCODE"; exit $LASTEXITCODE }
