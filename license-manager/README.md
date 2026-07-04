# Sufra Lite License Manager

CLI utilities to generate encrypted license files for the Sufra Lite POS Electron app.

## Quick Start

### Note: USB dongle licensing has been removed.

Use the machine-id-tool for the new machine-bound licensing flow. See `machine-id-tool/README.md`.

### Legacy: Generate a License (USB - deprecated)

```bash
cd license-manager

# For TRIAL license (30 days)
npx ts-node generate-license.ts <USB_SERIAL> trial E:\SUFRA_LICENSE\license.bin

# For YEARLY license (365 days)  
npx ts-node generate-license.ts <USB_SERIAL> yearly E:\SUFRA_LICENSE\license.bin
```

## License Types

| Type | Duration | Banner |
|------|----------|--------|
| `trial` | 30 days | Shows "Trial - X days remaining" |
| `yearly` | 365 days | No banner |

## License Format

The license file is encrypted with AES-256-GCM. The decrypted content is:

```json
{
  "product": "Sufra Lite",
  "license_type": "trial | yearly",
  "assigned_serial": "USB_VOLUME_SERIAL",
  "issued_at": "2026-01-21",
  "expires_at": "2026-02-20"
}
```

## Finding USB Serial Number

On Windows, run this PowerShell command:

```powershell
wmic logicaldisk where "DriveType=2" get DeviceID,VolumeSerialNumber,VolumeName
```

## Security

- License is encrypted with AES-256-GCM
- License is bound to specific USB serial number
- Tampering with the file will cause decryption to fail
- No online validation required

## Environment Variables

You can set a custom encryption key:

```bash
set LICENSE_SECRET_KEY=your-64-char-hex-key-here
```

The same key must be used in both the license-manager and the Electron app.
