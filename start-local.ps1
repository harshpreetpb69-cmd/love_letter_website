#Requires -Version 5.1
$root = Join-Path $PSScriptRoot "public"
$dataDir = Join-Path $PSScriptRoot "data"
$notesFile = Join-Path $dataDir "notes.json"
$port = 3000
$prefix = "http://localhost:$port/"

if (-not (Test-Path $dataDir)) { New-Item -ItemType Directory -Path $dataDir | Out-Null }
if (-not (Test-Path $notesFile)) { Set-Content -Path $notesFile -Value "[]" -Encoding UTF8 }

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".json" = "application/json; charset=utf-8"
}

function Get-Notes {
  try { return @(Get-Content $notesFile -Raw | ConvertFrom-Json) } catch { return @() }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  Write-Host "Could not bind $prefix. Try running as Administrator once, or close whatever is using port $port."
  throw
}
Write-Host "Love letter site: $prefix"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath)

  try {
    if ($path -eq "/api/health") {
      $json = '{"ok":true,"song":"Do Pal - ABRK"}'
      $bytes = [Text.Encoding]::UTF8.GetBytes($json)
      $res.ContentType = "application/json; charset=utf-8"
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } elseif ($path -eq "/api/notes" -and $req.HttpMethod -eq "GET") {
      $notes = Get-Notes
      if (-not $notes) { $notes = @() }
      $payload = @{ notes = @($notes | Sort-Object createdAt -Descending) }
      $json = $payload | ConvertTo-Json -Depth 5 -Compress
      $bytes = [Text.Encoding]::UTF8.GetBytes($json)
      $res.ContentType = "application/json; charset=utf-8"
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } elseif ($path -eq "/api/notes" -and $req.HttpMethod -eq "POST") {
      $reader = New-Object IO.StreamReader($req.InputStream, $req.ContentEncoding)
      $raw = $reader.ReadToEnd()
      $body = $raw | ConvertFrom-Json
      $from = ([string]$body.from).Trim()
      if (-not $from) { $from = "Wifey" }
      $message = ([string]$body.message).Trim()
      if ($message.Length -lt 2) {
        $res.StatusCode = 400
        $bytes = [Text.Encoding]::UTF8.GetBytes('{"error":"Message likhna zaroori hai."}')
      } else {
        $notes = @(Get-Notes)
        $notes += [pscustomobject]@{
          id = [DateTimeOffset]::Now.ToUnixTimeMilliseconds().ToString()
          from = $from
          message = $message
          createdAt = (Get-Date).ToUniversalTime().ToString("o")
        }
        $notes | ConvertTo-Json -Depth 5 | Set-Content $notesFile -Encoding UTF8
        $res.StatusCode = 201
        $bytes = [Text.Encoding]::UTF8.GetBytes('{"ok":true}')
      }
      $res.ContentType = "application/json; charset=utf-8"
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      if ($path -eq "/") { $path = "/index.html" }
      $safe = $path.TrimStart("/").Replace("/", "\")
      $file = Join-Path $root $safe
      if (-not (Test-Path $file)) { $file = Join-Path $root "index.html" }
      $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
      $bytes = [IO.File]::ReadAllBytes($file)
      $res.ContentType = $mime[$ext]
      if (-not $res.ContentType) { $res.ContentType = "application/octet-stream" }
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } catch {
    $res.StatusCode = 500
    $bytes = [Text.Encoding]::UTF8.GetBytes("Server error")
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } finally {
    $res.Close()
  }
}
