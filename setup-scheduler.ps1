# 美容勉強会ポータル - クローラー自動実行タスク登録
# 
# 使い方:
#   PowerShellを管理者権限で実行し、このスクリプトを実行:
#   powershell -ExecutionPolicy Bypass -File setup-scheduler.ps1
#
# 毎週月曜 09:00 にクローラーを実行するタスクを登録します。

$taskName = "BeautyPortalCrawler"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source

if (-not $nodePath) {
    Write-Host "エラー: Node.js がインストールされていません。" -ForegroundColor Red
    Write-Host "https://nodejs.org/ からインストールしてください。" -ForegroundColor Yellow
    exit 1
}

Write-Host "=== 美容勉強会ポータル クローラー スケジューラ設定 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "プロジェクトディレクトリ: $projectDir" -ForegroundColor Gray
Write-Host "Node.js: $nodePath" -ForegroundColor Gray
Write-Host ""

# 既存タスクを削除（再登録のため）
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "既存タスクを削除中..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# タスクアクション: node crawler.js を実行
$action = New-ScheduledTaskAction `
    -Execute $nodePath `
    -Argument "crawler.js" `
    -WorkingDirectory $projectDir

# トリガー: 毎週月曜 09:00
$trigger = New-ScheduledTaskTrigger `
    -Weekly `
    -DaysOfWeek Monday `
    -At "09:00"

# 設定: PC起動中でなくても実行可能にする
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

# タスク登録
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "美容勉強会ポータルのWebクローラーを週1回実行し、新しい学会・セミナー情報を自動取得します。" `
    -RunLevel Limited

Write-Host ""
Write-Host "✅ タスクスケジューラに登録完了！" -ForegroundColor Green
Write-Host "   タスク名: $taskName" -ForegroundColor Cyan
Write-Host "   実行頻度: 毎週月曜 09:00" -ForegroundColor Cyan
Write-Host ""
Write-Host "手動でクローラーを実行するには:" -ForegroundColor Gray
Write-Host "   cd $projectDir" -ForegroundColor White
Write-Host "   npm run crawl" -ForegroundColor White
