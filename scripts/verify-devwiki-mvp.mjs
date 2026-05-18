import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const DEFAULT_PORT = "3000";
const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DEVWIKI_E2E_EMAIL",
];

function loadEnvFile(path) {
  try {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split("=");

      if (!process.env[key]) {
        process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // CI can provide env vars without a local .env file.
  }
}

function report(status, label, detail = "") {
  const prefix =
    status === "pass" ? "PASS" : status === "info" ? "INFO" : "FAIL";
  console.log(`${prefix} ${label}${detail ? ` - ${detail}` : ""}`);
}

function ensureRequiredEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    missing.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  if (missing.length) {
    throw new Error(`Missing required MVP verification env: ${missing.join(", ")}`);
  }
}

async function runCommand(command, args, options = {}) {
  report("info", "Running", [command, ...args].join(" "));

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: {
        ...process.env,
        DEVWIKI_E2E_REQUIRED: "1",
        ...options.env,
      },
      shell: false,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with ${
            signal ? `signal ${signal}` : `exit code ${code}`
          }`,
        ),
      );
    });
  });
}

async function isReachable(baseUrl) {
  try {
    const response = await fetch(baseUrl, { redirect: "manual" });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

async function waitForServer(baseUrl, timeoutMs = 30_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isReachable(baseUrl)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Dev server did not become reachable at ${baseUrl}`);
}

async function ensureDevServer() {
  if (process.env.DEVWIKI_E2E_BASE_URL) {
    const baseUrl = process.env.DEVWIKI_E2E_BASE_URL;

    if (!(await isReachable(baseUrl))) {
      throw new Error(`DEVWIKI_E2E_BASE_URL is not reachable: ${baseUrl}`);
    }

    report("pass", "Existing dev server reachable", baseUrl);
    return { baseUrl, process: null };
  }

  const port = process.env.DEVWIKI_E2E_PORT ?? DEFAULT_PORT;
  const baseUrl = `http://localhost:${port}`;

  if (await isReachable(baseUrl)) {
    report("pass", "Existing dev server reachable", baseUrl);
    return { baseUrl, process: null };
  }

  report("info", "Starting dev server", baseUrl);
  const serverProcess = spawn("npm", ["run", "dev", "--", "--port", port], {
    env: process.env,
    shell: false,
    stdio: "inherit",
  });

  serverProcess.on("error", (error) => {
    report("fail", "Dev server failed to start", error.message);
  });

  await waitForServer(baseUrl);
  report("pass", "Dev server started", baseUrl);

  return { baseUrl, process: serverProcess };
}

async function main() {
  loadEnvFile(".env.local");
  ensureRequiredEnv();

  await runCommand("npm", ["run", "lint"]);
  await runCommand("npm", ["run", "build"]);
  await runCommand("npm", ["run", "verify:supabase"]);
  await runCommand("npm", ["run", "verify:mvp-data"]);

  const devServer = await ensureDevServer();

  try {
    await runCommand("npm", ["run", "verify:mvp-ui"], {
      env: {
        DEVWIKI_E2E_BASE_URL: devServer.baseUrl,
      },
    });
  } finally {
    if (devServer.process) {
      devServer.process.kill("SIGTERM");
    }
  }

  report("pass", "DevWiki MVP verification complete");
}

main().catch((error) => {
  report(
    "fail",
    "DevWiki MVP verification",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
