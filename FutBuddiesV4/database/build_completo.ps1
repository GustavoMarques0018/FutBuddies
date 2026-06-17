# ============================================================
#  Gera FutBuddiesDB_Completo.sql
#  Script consolidado que cria a base de dados FutBuddiesDB
#  do zero (SQL Server / SSMS), com todas as tabelas e migrações.
#
#  Como usar:  abrir PowerShell nesta pasta e correr:
#     ./build_completo.ps1
# ============================================================

$dbName = 'FutBuddiesDB'

# Ordem de aplicação (schema base + migrações incrementais)
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
    'FutBuddies_Migracao_v11.sql',
    'FutBuddies_Migracao_v12.sql',
    'FutBuddies_Migracao_v13.sql',
    'FutBuddies_Migracao_v14.sql'
)

$out = @()
$out += '-- ============================================================'
$out += '--  FutBuddies - Base de Dados COMPLETA (FutBuddiesDB)'
$out += '--  Script consolidado: cria a BD do zero com todas as tabelas.'
$out += '--  Como usar: abrir no SSMS > Nova Consulta > Executar (F5)'
$out += '--  Autor: Gustavo Marques - Projeto PAP 2026'
$out += '-- ============================================================'
$out += ''
$out += '-- Criar a base de dados'
$out += "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = '$dbName')"
$out += 'BEGIN'
$out += "    CREATE DATABASE $dbName COLLATE Latin1_General_CI_AI;"
$out += "    PRINT '== Base de dados $dbName criada.';"
$out += 'END'
$out += 'ELSE'
$out += "    PRINT '== Base de dados $dbName ja existe.';"
$out += 'GO'
$out += ''
$out += "USE $dbName;"
$out += 'GO'
$out += ''

foreach ($f in $ordem) {
    $path = Join-Path $PSScriptRoot $f
    if (-not (Test-Path $path)) { Write-Warning "Saltei $f (nao existe)"; continue }
    $out += ''
    $out += '-- ============================================================'
    $out += "-- Origem: $f"
    $out += '-- ============================================================'
    $linhas = Get-Content -Path $path -Encoding UTF8
    $skipDbBlock = $false
    foreach ($linha in $linhas) {
        # Saltar qualquer USE <db> (a BD ja foi selecionada no cabecalho)
        if ($linha -match '^\s*USE\s+\w+\s*;?\s*$') { continue }
        # Saltar bloco CREATE DATABASE IF NOT EXISTS ... GO
        if ($linha -match '^\s*IF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+name\s+FROM\s+sys\.databases') { $skipDbBlock = $true; continue }
        if ($skipDbBlock) {
            if ($linha -match '^\s*GO\s*$') { $skipDbBlock = $false }
            continue
        }
        # Saltar instrucoes de nivel-servidor (login/user/role nao sao necessarias)
        if ($linha -match '^\s*CREATE\s+LOGIN\b')  { continue }
        if ($linha -match '^\s*CREATE\s+USER\b')   { continue }
        if ($linha -match '^\s*ALTER\s+ROLE\b')    { continue }
        $out += $linha
    }
}

# ============================================================
#  PARTE 2 — Auto-migrações extraídas do backend (server.js)
#  O backend aplica estas colunas/tabelas no arranque. Incluímo-las
#  aqui para o schema ficar 100% completo só com este script.
#  (Todas idempotentes: IF COL_LENGTH IS NULL / IF OBJECT_ID IS NULL)
# ============================================================
$serverPath = Join-Path $PSScriptRoot '..\backend\server.js'
if (Test-Path $serverPath) {
    $out += ''
    $out += '-- ============================================================'
    $out += '-- PARTE 2 - Auto-migracoes (origem: backend/server.js)'
    $out += '-- Colunas e tabelas que o backend garante no arranque.'
    $out += '-- ============================================================'

    $srv = Get-Content -Path $serverPath -Encoding UTF8
    $inIniciar = $false
    $capturing = $false
    $bloco = @()
    foreach ($linha in $srv) {
        if ($linha -match 'async\s+function\s+iniciar') { $inIniciar = $true; continue }
        if (-not $inIniciar) { continue }
        if ($linha -match '^\s*server\.listen\(') { break }   # fim da zona de migrações

        if ($capturing) {
            # fim do bloco: linha com  `);
            if ($linha -match '^\s*`\)\s*;') {
                $capturing = $false
                if ($bloco.Count -gt 0) {
                    $out += ''
                    $out += $bloco
                    $out += 'GO'
                    $bloco = @()
                }
                continue
            }
            $bloco += $linha
            continue
        }

        # início de bloco: linha que termina em  query(`
        if ($linha -match '\.query\(`\s*$') { $capturing = $true; $bloco = @() }
    }
}

$outPath = Join-Path $PSScriptRoot 'FutBuddiesDB_Completo.sql'
$out -join "`r`n" | Out-File -FilePath $outPath -Encoding utf8 -Force
Write-Host "OK -> $outPath  ($($out.Count) linhas)"
