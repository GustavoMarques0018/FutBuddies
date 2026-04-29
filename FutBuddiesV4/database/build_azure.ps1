# Gera FutBuddies_Azure.sql consolidado e limpo (sem USE/CREATE DATABASE)
# para importar via Azure SQL Query Editor.

$ordem = @(
    'FutBuddies_SQL_Server.sql',
    'FutBuddies_Amigos.sql',
    'FutBuddies_Migracao_v2.sql',
    'FutBuddies_Equipas_v3.sql',
    'FutBuddies_Migracao_v4.sql',
    'FutBuddies_Migracao_v5.sql',
    'FutBuddies_Migracao_v6.sql',
    'FutBuddies_Migracao_v7.sql',
    'FutBuddies_Migracao_v8.sql',
    'FutBuddies_Migracao_v9.sql',
    'FutBuddies_Migracao_v10.sql',
    'FutBuddies_Migracao_v11.sql'
)

$out = @()
$out += '-- =============================================='
$out += '-- FutBuddies - Schema consolidado para Azure SQL'
$out += '-- Gerado por build_azure.ps1'
$out += '-- =============================================='
$out += ''

foreach ($f in $ordem) {
    $path = Join-Path $PSScriptRoot $f
    if (-not (Test-Path $path)) { Write-Warning "Saltei $f (nao existe)"; continue }
    $out += ''
    $out += '-- =============================================='
    $out += "-- Ficheiro: $f"
    $out += '-- =============================================='
    $linhas = Get-Content -Path $path -Encoding UTF8
    $skipBlock = $false
    $skipLoginBlock = $false
    foreach ($linha in $linhas) {
        # Saltar qualquer USE <db> (Azure SQL nao suporta cross-db USE)
        if ($linha -match '^\s*USE\s+\w+\s*;?\s*$') { continue }
        # Saltar bloco CREATE DATABASE IF NOT EXISTS ... GO
        if ($linha -match '^\s*IF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+name\s+FROM\s+sys\.databases') { $skipBlock = $true; continue }
        if ($skipBlock) {
            if ($linha -match '^\s*GO\s*$') { $skipBlock = $false }
            continue
        }
        # Saltar bloco CREATE LOGIN / CREATE USER (em Azure SQL o admin ja tem acesso)
        if ($linha -match '^\s*CREATE\s+LOGIN\b') { $skipLoginBlock = $true; continue }
        if ($skipLoginBlock) {
            if ($linha -match '^\s*ALTER\s+ROLE\b' -or $linha -match '^\s*CREATE\s+USER\b') { continue }
            if ($linha -match '^\s*GO\s*$') {
                # consumimos o GO final do bloco
                $skipLoginBlock = $false
                continue
            }
            continue
        }
        $out += $linha
    }
}

$outPath = Join-Path $PSScriptRoot 'FutBuddies_Azure.sql'
$out -join "`r`n" | Out-File -FilePath $outPath -Encoding utf8 -Force
Write-Host "OK -> $outPath  ($($out.Count) linhas)"
