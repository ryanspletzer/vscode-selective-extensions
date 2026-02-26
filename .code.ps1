#!/usr/bin/env pwsh
# Launch VS Code with only the extensions recommended for this project.
# Reads .vscode/extensions.json and disables everything else.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ExtensionsJson = Join-Path $ScriptDir '.vscode' 'extensions.json'

if (-not (Test-Path $ExtensionsJson)) {
    Write-Warning 'No .vscode/extensions.json found — launching VS Code normally.'
    code $ScriptDir
    return
}

$Wanted = (Get-Content $ExtensionsJson -Raw | ConvertFrom-Json).recommendations
$Installed = code --list-extensions

$DisableFlags = @()
foreach ($Ext in $Installed) {
    if ($Ext -notin $Wanted) {
        $DisableFlags += '--disable-extension'
        $DisableFlags += $Ext
    }
}

code @DisableFlags $ScriptDir
