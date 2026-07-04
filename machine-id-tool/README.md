# Sufra POS - Machine ID Tool

Get your PC's Machine ID in one click. **No technical knowledge required.**

## For Customers

1. Download the `machine-id-tool` folder from your seller
2. **Double-click `Get-Machine-ID.bat`**
3. Your Machine ID will appear (and is copied automatically)
4. Paste it in WhatsApp/Telegram and send to your seller
5. You will receive a custom Sufra POS installer

## For Sellers

1. Send customers the `machine-id-tool` folder
2. Customer double-clicks `Get-Machine-ID.bat` and sends you the ID (e.g. `MACHINE-F3016B6C`)
3. **First time only:** Run `node electron/scripts/license-keys/generate-keys.js` to create signing keys
4. Build (in electron folder):
   - **CMD:** `set MACHINE_ID=F3016B6C && set LICENSE_TYPE=1m && npm run dist`
   - **PowerShell:** `$env:MACHINE_ID="F3016B6C"; $env:LICENSE_TYPE="1m"; npm run dist`
5. Send the EXE to the customer

**License types:** `5d` (5 days), `1m` (1 month), `2m` (2 months), `1y` (1 year), `lifetime`

Licenses are cryptographically signed – only you can create valid licenses.
