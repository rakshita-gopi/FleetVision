#!/usr/bin/env node
/**
 * Starts Next.js on the first free port (default start: 3000).
 * If another FleetVision Next process already occupies the preferred port,
 * we claim the next available one instead of failing or colliding.
 */
import { spawn } from "child_process";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const START_PORT = Number(process.env.PORT || process.env.FRONTEND_PORT || 3000);
const MAX_TRIES = 20;

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.on("error", () => resolve(false));
    server.listen(port, "0.0.0.0", () => {
      server.close(() => resolve(true));
    });
  });
}

async function findPort(start) {
  for (let p = start; p < start + MAX_TRIES; p++) {
    if (await canListen(p)) return p;
  }
  throw new Error(`No free port found between ${start} and ${start + MAX_TRIES - 1}`);
}

async function main() {
  const port = await findPort(START_PORT);
  if (port !== START_PORT) {
    console.log(`\n⚠  Port ${START_PORT} is busy — starting FleetVision on http://localhost:${port}\n`);
  } else {
    console.log(`\n▶  FleetVision frontend → http://localhost:${port}\n`);
  }

  const nextBin = path.join(__dirname, "..", "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "--port", String(port), "--hostname", "0.0.0.0", "--webpack"], {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      NEXT_PUBLIC_APP_ORIGIN: `http://localhost:${port}`,
    },
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
