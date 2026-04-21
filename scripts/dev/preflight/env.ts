// scripts/dev/preflight/env.ts
import fs from "node:fs/promises"

export function parseEnvKeys(content: string): string[] {
  const keys: string[] = []
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (key) keys.push(key)
  }
  return keys
}

export type ParityResult =
  | { ok: true }
  | { ok: false; reason: "missing-env" }
  | { ok: false; reason: "missing-keys"; keys: string[] }

export async function checkEnvParity(opts: {
  envExample: string
  envPath: string
}): Promise<ParityResult> {
  const exampleContent = await fs.readFile(opts.envExample, "utf8")
  const exampleKeys = parseEnvKeys(exampleContent)

  let envContent: string
  try {
    envContent = await fs.readFile(opts.envPath, "utf8")
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { ok: false, reason: "missing-env" }
    }
    throw err
  }

  const envKeys = new Set(parseEnvKeys(envContent))
  const missing = exampleKeys.filter((k) => !envKeys.has(k))
  if (missing.length > 0) {
    return { ok: false, reason: "missing-keys", keys: missing }
  }
  return { ok: true }
}

export type FixAction =
  | { envExample: string; envPath: string; action: "copy" }
  | { envExample: string; envPath: string; action: "append"; missingKeys: string[] }

export async function fixEnvFile(action: FixAction): Promise<void> {
  if (action.action === "copy") {
    await fs.copyFile(action.envExample, action.envPath)
    return
  }

  // append: read example, find lines for missing keys, append them
  const exampleContent = await fs.readFile(action.envExample, "utf8")
  const missingSet = new Set(action.missingKeys)
  const linesToAppend: string[] = []
  for (const rawLine of exampleContent.split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (missingSet.has(key)) linesToAppend.push(rawLine)
  }

  const existing = await fs.readFile(action.envPath, "utf8")
  const separator = existing.endsWith("\n") ? "" : "\n"
  const appendix = `${linesToAppend.join("\n")}\n`
  await fs.writeFile(action.envPath, existing + separator + appendix)
}
