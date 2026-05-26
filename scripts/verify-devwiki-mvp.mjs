import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const DEFAULT_PORT = "3000";
const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DEVWIKI_E2E_EMAIL",
  "DEVWIKI_E2E_PASSWORD",
];
const PUBLIC_KEY_ENV = [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
];
const PLACEHOLDER_VALUES = new Set([
  "https://your-project-ref.supabase.co",
  "sb_publishable_your_key",
  "your_legacy_anon_key",
  "your_service_role_key",
  "you@example.com",
  "change-this-password",
]);

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

function envValue(key) {
  return process.env[key]?.trim() ?? "";
}

function getJwtRole(value) {
  const parts = value.split(".");

  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );

    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function getSupabaseKeyKind(value) {
  if (value.startsWith("sb_publishable_")) {
    return "publishable";
  }

  if (value.startsWith("sb_secret_")) {
    return "secret";
  }

  const jwtRole = getJwtRole(value);

  if (jwtRole === "anon" || jwtRole === "service_role") {
    return jwtRole;
  }

  return "unknown";
}

function validateUrlEnv(problems, key) {
  const value = envValue(key);

  if (!value) {
    return;
  }

  try {
    new URL(value);
  } catch {
    problems.push(`${key} must be a valid URL`);
  }
}

function validatePublicKey(problems, key) {
  const value = envValue(key);

  if (!value) {
    return;
  }

  const kind = getSupabaseKeyKind(value);

  if (kind === "secret" || kind === "service_role") {
    problems.push(`${key} must not contain a Supabase secret/service role key`);
    return;
  }

  if (kind === "unknown") {
    problems.push(
      `${key} must be an sb_publishable_ key or a legacy anon JWT key`,
    );
  }
}

function validateServiceRoleKey(problems) {
  const value = envValue("SUPABASE_SERVICE_ROLE_KEY");

  if (!value) {
    return;
  }

  const kind = getSupabaseKeyKind(value);

  if (kind !== "secret" && kind !== "service_role") {
    problems.push(
      "SUPABASE_SERVICE_ROLE_KEY must be an sb_secret_ key or a legacy service_role JWT key",
    );
  }

  for (const publicKey of PUBLIC_KEY_ENV) {
    if (value && value === envValue(publicKey)) {
      problems.push(`SUPABASE_SERVICE_ROLE_KEY must not equal ${publicKey}`);
    }
  }
}

function validateEmailEnv(problems) {
  const value = envValue("DEVWIKI_E2E_EMAIL");

  if (!value) {
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    problems.push("DEVWIKI_E2E_EMAIL must be a valid email address");
  }

  if (value !== value.toLowerCase()) {
    problems.push(
      "DEVWIKI_E2E_EMAIL must be lowercase to match members.email",
    );
  }
}

function validatePasswordEnv(problems) {
  const value = envValue("DEVWIKI_E2E_PASSWORD");

  if (!value) {
    return;
  }

  if (value.length < 6) {
    problems.push("DEVWIKI_E2E_PASSWORD must be at least 6 characters");
  }
}

function validatePortEnv(problems) {
  const value = envValue("DEVWIKI_E2E_PORT");

  if (!value) {
    return;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    problems.push("DEVWIKI_E2E_PORT must be an integer between 1 and 65535");
  }
}

function ensureRequiredEnv() {
  const problems = [];

  for (const key of REQUIRED_ENV) {
    if (!envValue(key)) {
      problems.push(`Missing ${key}`);
    }
  }

  if (!PUBLIC_KEY_ENV.some((key) => envValue(key))) {
    problems.push(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  for (const key of [
    ...REQUIRED_ENV,
    ...PUBLIC_KEY_ENV,
    "DEVWIKI_E2E_BASE_URL",
    "DEVWIKI_E2E_PORT",
  ]) {
    const value = envValue(key);

    if (value && PLACEHOLDER_VALUES.has(value)) {
      problems.push(`${key} still contains an .env.example placeholder`);
    }
  }

  validateUrlEnv(problems, "NEXT_PUBLIC_SUPABASE_URL");
  validateUrlEnv(problems, "DEVWIKI_E2E_BASE_URL");

  for (const key of PUBLIC_KEY_ENV) {
    validatePublicKey(problems, key);
  }

  validateServiceRoleKey(problems);
  validateEmailEnv(problems);
  validatePasswordEnv(problems);
  validatePortEnv(problems);

  if (problems.length) {
    throw new Error(
      `MVP verification env is not ready: ${problems.join("; ")}`,
    );
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
  await runCommand("npm", ["run", "test"]);
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
