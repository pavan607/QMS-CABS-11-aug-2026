/**
 * Remove .next so production `next build` never reuses Turbopack dev artifacts.
 * (Dev uses `next dev --turbopack`; mixing caches causes missing [turbopack]_runtime.js.)
 */
const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const targets = [
  path.join(projectRoot, ".next"),
  path.join(projectRoot, "node_modules", ".cache"),
];

function sleep(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* spin */
  }
}

function removeDir(dir, maxAttempts = 6) {
  if (!fs.existsSync(dir)) return true;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      fs.rmSync(dir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 250,
      });
    } catch (err) {
      if (attempt === maxAttempts) {
        console.error(`Failed to remove ${path.relative(projectRoot, dir)}: ${err.message}`);
        return false;
      }
      sleep(400 * attempt);
      continue;
    }

    if (!fs.existsSync(dir)) return true;
    sleep(400 * attempt);
  }

  return !fs.existsSync(dir);
}

let ok = true;
for (const dir of targets) {
  if (!removeDir(dir)) ok = false;
}

if (ok) {
  console.log("Removed .next (clean build cache)");
} else {
  console.error(
    "\nCould not fully delete the build cache.\n" +
      "Stop `npm run dev` and any process using the project folder, then retry `npm run build`.\n"
  );
  process.exit(1);
}
