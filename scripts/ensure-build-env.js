/**
 * Guard production builds: dev must be stopped and .next must not be locked.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin */
  }
}

function findNextDevPids() {
  const pids = [];
  try {
    if (process.platform === "win32") {
      const out = execSync(
        'wmic process where "name=\'node.exe\'" get ProcessId,CommandLine 2>nul',
        { encoding: "utf8", timeout: 15000 }
      );
      for (const line of out.split(/\r?\n/)) {
        if (!/next(?:\.cmd)?["']?\s+dev\b/i.test(line)) continue;
        const m = line.match(/\s(\d+)\s*$/);
        if (m) pids.push(m[1]);
      }
      return pids;
    }
    const out = execSync("ps -eo pid=,args= 2>/dev/null || ps aux", {
      encoding: "utf8",
      timeout: 15000,
    });
    for (const line of out.split(/\r?\n/)) {
      if (!/next(?:\.cmd)?\s+dev\b/i.test(line)) continue;
      const m = line.trim().match(/^(\d+)/);
      if (m) pids.push(m[1]);
    }
  } catch {
    /* ignore */
  }
  return pids;
}

function documentUsesTurbopackRuntime() {
  const doc = path.join(projectRoot, ".next", "server", "pages", "_document.js");
  if (!fs.existsSync(doc)) return false;
  return fs.readFileSync(doc, "utf8").includes("[turbopack]_runtime");
}

const devPids = findNextDevPids();
if (devPids.length > 0) {
  const pidHint =
    process.platform === "win32"
      ? `  taskkill /PID ${devPids.join(" /F /PID ")} /F`
      : `  kill ${devPids.join(" ")}`;
  console.error(
    "\nProduction build blocked: `next dev` is still running.\n" +
      `Process ID(s): ${devPids.join(", ")}\n` +
      "Stop the dev terminal (Ctrl+C on `npm run dev`), or run:\n" +
      `${pidHint}\n` +
      "Then run `npm run build` again.\n"
  );
  process.exit(1);
}

if (documentUsesTurbopackRuntime()) {
  console.warn(
    "Stale Turbopack artifacts detected in .next — running clean before build..."
  );
  require("./clean-next.js");
  sleep(500);
  if (documentUsesTurbopackRuntime()) {
    console.error(
      "\nCould not remove Turbopack build cache.\n" +
        "Close programs using .next, stop `npm run dev`, then run:\n" +
        "  npm run clean\n" +
        "  npm run build\n"
    );
    process.exit(1);
  }
}
