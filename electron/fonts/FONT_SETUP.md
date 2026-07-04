# Font Setup for Printing

## Required Fonts

The printing system requires Arabic fonts for proper RTL text rendering. The system will try fonts in this order:

1. **Tajawal-Regular.ttf** (preferred) - Place in `electron/fonts/Tajawal-Regular.ttf`
2. **IBMPlexSansArabic-Regular.ttf** (fallback) - Place in `electron/fonts/IBMPlexSansArabic-Regular.ttf`
3. System fonts (Cairo, NotoSansArabic) - Automatically detected on Linux

## Download Fonts

### Tajawal
Download from: https://fonts.google.com/specimen/Tajawal
- Download the Regular weight
- Place `Tajawal-Regular.ttf` in `electron/fonts/`

### IBM Plex Sans Arabic (Optional)
Download from: https://fonts.google.com/specimen/IBM+Plex+Sans+Arabic
- Download the Regular weight
- Place `IBMPlexSansArabic-Regular.ttf` in `electron/fonts/`

## Font Loading

Fonts are automatically registered when the Electron app starts. Check the console for:
- `[PRINT] Arabic font registered: Tajawal` (success)
- `[PRINT] ⚠️ No Arabic font found!` (warning - will use fallback)

## Testing

After adding fonts, restart the Electron app and check the console logs to verify font registration.

