param(
  [int]$Port = 8090
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

$MimeTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".ico"  = "image/x-icon"
}

function Resolve-SitePath {
  param([string]$UrlPath)

  $relativePath = [Uri]::UnescapeDataString(($UrlPath -split "\?")[0].TrimStart("/"))
  if ([string]::IsNullOrWhiteSpace($relativePath)) {
    $relativePath = "index.html"
  }

  $candidate = Join-Path $Root $relativePath
  $resolvedRoot = [System.IO.Path]::GetFullPath($Root)
  $resolvedCandidate = [System.IO.Path]::GetFullPath($candidate)

  if (-not $resolvedCandidate.StartsWith($resolvedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }

  if (Test-Path -LiteralPath $resolvedCandidate -PathType Container) {
    return Join-Path $resolvedCandidate "index.html"
  }

  return $resolvedCandidate
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [string]$ContentType,
    [byte[]]$Body
  )

  $headers = "HTTP/1.1 $StatusCode $StatusText`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`nCache-Control: no-store`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
$listener.Start()
Write-Host "RH Zone storefront running at http://localhost:$Port/"

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $stream.ReadTimeout = 3000
      $stream.WriteTimeout = 3000
      $buffer = New-Object byte[] 8192
      $read = $stream.Read($buffer, 0, $buffer.Length)
      if ($read -le 0) {
        continue
      }

      $request = [System.Text.Encoding]::ASCII.GetString($buffer, 0, $read)
      $requestLine = ($request -split "`r?`n")[0]
      $parts = $requestLine -split " "
      $method = if ($parts.Length -gt 0) { $parts[0] } else { "" }
      $path = if ($parts.Length -gt 1) { $parts[1] } else { "/" }

      if ($method -ne "GET" -and $method -ne "HEAD") {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Method not allowed")
        Send-Response -Stream $stream -StatusCode 405 -StatusText "Method Not Allowed" -ContentType "text/plain; charset=utf-8" -Body $body
        continue
      }

      $filePath = Resolve-SitePath -UrlPath $path
      if ($null -eq $filePath -or -not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
        Send-Response -Stream $stream -StatusCode 404 -StatusText "Not Found" -ContentType "text/plain; charset=utf-8" -Body $body
        continue
      }

      $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $contentType = if ($MimeTypes.ContainsKey($extension)) { $MimeTypes[$extension] } else { "application/octet-stream" }
      $bodyBytes = if ($method -eq "HEAD") { New-Object byte[] 0 } else { [System.IO.File]::ReadAllBytes($filePath) }
      Send-Response -Stream $stream -StatusCode 200 -StatusText "OK" -ContentType $contentType -Body $bodyBytes
    }
    catch {
      try {
        $body = [System.Text.Encoding]::UTF8.GetBytes("Server error")
        Send-Response -Stream $stream -StatusCode 500 -StatusText "Server Error" -ContentType "text/plain; charset=utf-8" -Body $body
      }
      catch {
      }
    }
    finally {
      $client.Close()
    }
  }
}
finally {
  $listener.Stop()
}
