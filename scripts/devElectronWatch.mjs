import { spawn } from "node:child_process";
import { existsSync, watch } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const electronPath = require("electron");

const rootDir = process.cwd();
const electronOutDir = path.join(rootDir, "dist", "electron");
const mainPath = path.join(electronOutDir, "main.js");

let appProcess = null;
let isRestarting = false;
let restartTimer = null;

function log(message) {
  console.log(`[electron-dev] ${message}`);
}

function startApp() {
  if (!existsSync(mainPath)) {
    log(`waiting for ${path.relative(rootDir, mainPath)}`);
    return;
  }

  appProcess = spawn(electronPath, [mainPath], {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit",
    windowsHide: false,
  });

  appProcess.once("exit", (code, signal) => {
    appProcess = null;
    if (isRestarting) {
      isRestarting = false;
      startApp();
      return;
    }

    log(`app exited (${signal ?? code ?? 0}); waiting for Electron build changes`);
  });
}

function restartApp(changedFile) {
  if (restartTimer) {
    clearTimeout(restartTimer);
  }

  restartTimer = setTimeout(() => {
    restartTimer = null;
    log(`Electron build changed: ${changedFile ?? "unknown"}; restarting app`);

    if (!appProcess) {
      startApp();
      return;
    }

    isRestarting = true;
    appProcess.kill("SIGINT");
  }, 150);
}

function stopApp() {
  if (appProcess) {
    appProcess.kill("SIGINT");
  }
}

process.once("SIGINT", () => {
  stopApp();
  process.exit(0);
});

process.once("SIGTERM", () => {
  stopApp();
  process.exit(0);
});

if (!existsSync(electronOutDir)) {
  log(`waiting for ${path.relative(rootDir, electronOutDir)}`);
}

watch(electronOutDir, { recursive: true }, (_eventType, filename) => {
  if (!filename || !/\.(c|m)?js$/i.test(filename)) {
    return;
  }

  restartApp(filename);
});

log("watching dist/electron only");
startApp();
