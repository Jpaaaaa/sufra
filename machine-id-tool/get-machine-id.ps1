# Sufra POS - Machine ID Generator (PowerShell)
# Double-click Get-Machine-ID.bat to run.
# No Node.js required - works on any Windows 10/11.

$ErrorActionPreference = "SilentlyContinue"
$parts = @()

# Method 1: Motherboard UUID (most stable)
try {
    $uuid = (Get-CimInstance Win32_ComputerSystemProduct).UUID
    if ($uuid) { $parts += $uuid }
} catch {}

# Method 2: CPU Processor ID
try {
    $cpuId = (Get-CimInstance Win32_Processor | Select-Object -First 1).ProcessorId
    if ($cpuId) { $parts += $cpuId }
} catch {}

# Method 3: First disk serial
try {
    $diskSerial = (Get-CimInstance Win32_DiskDrive | Select-Object -First 1).SerialNumber
    if ($diskSerial) { $parts += $diskSerial.Trim() }
} catch {}

# Method 4: BIOS serial (fallback)
if ($parts.Count -lt 2) {
    try {
        $biosSerial = (Get-CimInstance Win32_BIOS).SerialNumber
        if ($biosSerial) { $parts += $biosSerial }
    } catch {}
}

if ($parts.Count -eq 0) {
    $wshell = New-Object -ComObject WScript.Shell
    $wshell.Popup("Could not read hardware identifiers. Try running as Administrator.", 0, "Sufra - Machine ID Error", 0x10)
    exit 1
}

# Combine and hash
$combined = ($parts -join "|") -replace "\s+", ""
$bytes = [System.Text.Encoding]::UTF8.GetBytes($combined)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
$hex = [BitConverter]::ToString($hash).Replace("-", "").ToLower()
$machineId = $hex.Substring(0, 8).ToUpper()
$formatted = "MACHINE-$machineId"

# Copy to clipboard
Set-Clipboard -Value $formatted

# Show popup
$wshell = New-Object -ComObject WScript.Shell
$wshell.Popup("Your Machine ID: $formatted`n`n(Copied to clipboard - paste and send to your seller)", 0, "Sufra - Machine ID", 0x40)
