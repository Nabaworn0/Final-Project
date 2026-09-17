// Local-only migrations: do not replay legacy migrations against existing user data.
import { readFile } from "node:fs/promises";
process.env.WRANGLER_WRITE_LOGS = "false";
process.env.WRANGLER_LOG_PATH = ".wrangler/logs";
process.env.MINIFLARE_REGISTRY_PATH = ".wrangler/registry";
const { getPlatformProxy } = await import("wrangler");
const proxy = await getPlatformProxy({ configPath: "wrangler.local.json", persist: { path: ".wrangler/state/v3" } });
try {
  const db = proxy.env.DB;
  await db.prepare("CREATE TABLE IF NOT EXISTS course_schema_migrations (name TEXT PRIMARY KEY NOT NULL, applied_at INTEGER NOT NULL)").run();
  for (const name of ["0004_course_management", "0005_course_cohorts"]) {
    const applied = await db.prepare("SELECT name FROM course_schema_migrations WHERE name = ?").bind(name).first();
    if (!applied) {
      const sql = await readFile(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
      // The journal insert and every schema statement commit or roll back together.
      await db.batch([
        ...sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)),
        db.prepare("INSERT INTO course_schema_migrations VALUES (?, ?)").bind(name, Date.now()),
      ]);
      console.log(`Course database migration ${name} applied locally.`);
    }
  }
} finally {
  await proxy.dispose();
}
