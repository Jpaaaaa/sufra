# Arabic Fonts Directory

This directory should contain the Tajawal Arabic font file for bitmap printing.

## Required Font File

Please add `Tajawal-Regular.ttf` to this directory.

You can download it from:
- Google Fonts: https://fonts.google.com/specimen/Tajawal
- Or use any other Arabic font that supports RTL text rendering

## Alternative Fonts

If Tajawal is not available, you can use:
- Amiri
- Cairo
- Noto Sans Arabic
- Any other Arabic font that supports UTF-8

To use a different font, update the font registration in `electron/printing.ts`:
```typescript
registerFont(path.join(__dirname, 'fonts', 'YourFont-Regular.ttf'), { family: 'YourFont' });
```

