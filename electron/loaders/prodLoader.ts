import path from "path";
import fs from "fs";
import { app, BrowserWindow } from "electron";

export function loadProd(win: BrowserWindow) {
  const appPath = app.getAppPath();
  const prodIndex = path.resolve(appPath, "frontend", ".next", "server", "app", "index.html");

  console.log("[PROD] App path:", appPath);
  console.log("[PROD] Loading:", prodIndex);
  console.log("[PROD] File exists:", fs.existsSync(prodIndex));

  if (!fs.existsSync(prodIndex)) {
    console.error("[PROD] Index.html not found at:", prodIndex);
    win.webContents.openDevTools();
    return;
  }

  const fileUrl = `file://${prodIndex}`;
  console.log("[PROD] Loading URL:", fileUrl);
  
  win.loadURL(fileUrl).catch((err: Error) => {
    console.error("[PROD] Failed to load index.html:", err);
    win.webContents.openDevTools();
  });
}
