import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { once } from "node:events";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import { assembleProject, verifyProject, zipProject } from "../src/lib/project-export.ts";

function unzip(archive) {
  const result = spawnSync("python3", ["-c", "import sys,zipfile,io,json\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))\nprint(json.dumps({n:z.read(n).decode() for n in z.namelist()}))"], {
    input: archive, encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("ZIP preserves saved files verbatim and marks generated scaffolding", () => {
  const source = [{ path: "src/main.jsx", content: "export default 'student work';\n" }];
  const archive = zipProject(assembleProject(source, "React", "Example"));
  const extracted = unzip(archive);
  assert.equal(extracted["src/main.jsx"], source[0].content);
  assert.match(extracted["README.md"], /saved student-written file/);
  assert.match(extracted["README.md"], /package.json/);
  assert.equal(extracted["package.json"].includes("student work"), false);
  assert.equal(extracted["src/App.jsx"], undefined);
});

test("rejects unsafe and conflicting saved file names", () => {
  for (const path of ["../secret", "/etc/passwd", "src/../../secret", "src\\file.js"]) {
    assert.throws(() => assembleProject([{ path, content: "a" }], "Node.js", "Example"));
  }
  assert.throws(() => assembleProject([
    { path: "src/main.js", content: "a" }, { path: "SRC/MAIN.js", content: "b" },
  ], "Node.js", "Example"));
});

test("reports syntax and missing local imports, never a full-build pass", async () => {
  const bad = await verifyProject([{ path: "src/main.jsx", content: "import './missing';\n" }], "React");
  assert.equal(bad.status, "failed");
  assert.match(bad.issues[0].message, /Missing saved local import/);
  const syntax = await verifyProject([{ path: "src/index.js", content: "const = ;" }], "Node.js");
  assert.equal(syntax.status, "failed");
  assert.equal(syntax.issues[0].path, "src/index.js");
  const good = await verifyProject([{ path: "src/index.js", content: "console.log('hello');" }], "Node.js");
  assert.equal(good.status, "passed");
  assert.match(good.note, /لم يُشغّل/);
  const unavailable = await verifyProject([{ path: "lib/main.dart", content: "not dart" }], "Flutter");
  assert.equal(unavailable.status, "unavailable");
});

// The HTTP test deliberately uses the real auth middleware and database, not a
// mocked projectSource: a missing user filter must make these assertions fail.
test("project API keeps two students' saved files separate after reload", { timeout: 60000 }, async (t) => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for the API integration test");
  assert.ok(process.env.SESSION_SECRET || process.env.JWT_SECRET, "A session secret is required");

  const built = spawnSync("pnpm", ["--filter", "@workspace/api-server", "run", "build"], {
    encoding: "utf8", timeout: 30000,
  });
  assert.equal(built.status, 0, built.stderr || built.stdout);

  // Resolve pg from the workspace package which owns the database dependency.
  const requireDb = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
  const { Pool } = requireDb("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const createdIds = [];
  let child;
  t.after(async () => {
    if (child) {
      child.kill();
      await Promise.race([once(child, "exit"), new Promise(resolve => setTimeout(resolve, 2000))]);
    }
    try {
      for (const id of createdIds) {
        await pool.query("DELETE FROM users WHERE id = $1", [id]);
      }
    } finally {
      await pool.end();
    }
  });

  const portPicker = createServer();
  portPicker.listen(0, "127.0.0.1");
  await once(portPicker, "listening");
  const port = portPicker.address().port;
  await new Promise((resolve, reject) => portPicker.close(error => error ? reject(error) : resolve()));
  child = spawn(process.execPath, ["dist/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port), NODE_ENV: "test", LOG_LEVEL: "silent" },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let serverErrors = "";
  child.stderr.on("data", chunk => { serverErrors += chunk.toString().slice(0, 2000); });
  const base = `http://127.0.0.1:${port}/api`;
  const request = (path, cookie, options = {}) => fetch(`${base}${path}`, {
    ...options,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...options.headers },
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) break;
    try {
      const health = await request("/healthz");
      if (health.ok) { ready = true; break; }
    } catch { /* Server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `API did not start: ${serverErrors}`);

  async function student(label) {
    const response = await request("/auth/signup", null, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: label, email: `project-export-${randomUUID()}@example.test`,
        password: `test-password-${randomUUID()}`,
      }),
    });
    if (response.status !== 201) assert.fail(`signup failed (${response.status}): ${await response.text()}`);
    const data = await response.json();
    createdIds.push(data.user.id);
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(cookie, "signup should issue a session cookie");
    return { id: data.user.id, cookie };
  }
  const alice = await student("Alice");
  const bob = await student("Bob");

  const sources = [
    { student: alice, name: "Alice's project", entry: "console.log('ALICE_ONLY_18');\n", extraPath: "src/alice.js", extra: "export const owner = 'ALICE_PRIVATE_18';\n" },
    { student: bob, name: "Bob's project", entry: "console.log('BOB_ONLY_29');\n", extraPath: "src/bob.js", extra: "const = 'BOB_PRIVATE_29';\n" },
  ];
  for (const { student: owner, name, entry, extraPath, extra } of sources) {
    await pool.query("UPDATE users SET project_name = $1, tech_stack = 'Node.js' WHERE id = $2", [name, owner.id]);
    await pool.query(
      "INSERT INTO project_structures (user_id, project_name, tech_stack, project_summary, files) VALUES ($1, $2, 'Node.js', 'Integration test project', $3)",
      [owner.id, name, JSON.stringify([
        { path: "src/index.js", day: 1, concept: "Entrypoint", description: "Entry" },
        { path: extraPath, day: 2, concept: "Extra", description: "Second file" },
      ])],
    );
    const session = await pool.query(
      "INSERT INTO sessions (user_id, concept, touches_completed, mistakes, xp_earned) VALUES ($1, 'Entrypoint — entry', 5, 0, 110) RETURNING id",
      [owner.id],
    );
    owner.sessionId = session.rows[0].id;
    await pool.query(
      "INSERT INTO project_files (user_id, path, content, concept_name_en, status, completed_session_id) VALUES ($1, 'src/index.js', $2, 'Entrypoint', 'complete', $3), ($1, $4, $5, 'Extra', 'in_progress', NULL)",
      [owner.id, entry, owner.sessionId, extraPath, extra],
    );
  }

  await t.test("anonymous clients cannot export or verify", async () => {
    for (const path of ["/project-export", "/project-verification"]) {
      const response = await request(path);
      assert.equal(response.status, 401);
      assert.notEqual(response.headers.get("content-type"), "application/zip");
      assert.equal((await response.json()).error !== undefined, true);
    }
  });

  await t.test("each ZIP contains only its owner's exact saved bytes and labeled scaffolding", async () => {
    for (const own of sources) {
      const other = sources.find(item => item !== own);
      const response = await request("/project-export", own.student.cookie);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type"), /application\/zip/);
      assert.match(response.headers.get("content-disposition"), /kodia-project\.zip/);
      assert.match(response.headers.get("cache-control"), /no-store/);
      const archive = unzip(Buffer.from(await response.arrayBuffer()));
      assert.deepEqual(Object.keys(archive).sort(), [".gitignore", "README.md", "package.json", "src/index.js", own.extraPath].sort());
      assert.equal(archive["src/index.js"], own.entry);
      assert.equal(archive[own.extraPath], own.extra);
      assert.equal(archive[other.extraPath], undefined);
      assert.ok(!JSON.stringify(archive).includes(other.entry.trim()));
      assert.ok(!JSON.stringify(archive).includes(other.extra.trim()));
      assert.match(archive["README.md"], /saved student-written file/);
      assert.match(archive["README.md"], /Generated setup files are not student-written code/);
    }
  });

  await t.test("verification reports use only the caller's saved code", async () => {
    for (const own of sources) {
      const response = await request("/project-verification", own.student.cookie);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control"), /no-store/);
      const report = await response.json();
      assert.equal(report.checked_files, 2);
      assert.equal(report.status, own.student.id === alice.id ? "passed" : "failed", JSON.stringify(report));
      assert.deepEqual(report.issues.map(issue => issue.path), own.student.id === alice.id ? [] : [own.extraPath]);
      assert.ok(!JSON.stringify(report).includes(sources.find(item => item !== own).extraPath));
    }
  });

  await t.test("completed files stay readable and cannot be edited after a new request", async () => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Damascus", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const datePart = type => parts.find(part => part.type === type).value;
    const today = `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
    await pool.query(
      "INSERT INTO generated_sessions (user_id, session_date, payload, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')",
      [alice.id, today, JSON.stringify({
        concept_name_en: "Entrypoint", concept_name_ar: "entry",
        touch4_build: { target_file: "src/index.js", file_action: "modify", existing_content: sources[0].entry },
      })],
    );
    const structure = await request("/project-structure", alice.cookie);
    assert.equal(structure.status, 200);
    const data = await structure.json();
    assert.equal(data.completed_files, 1);
    assert.deepEqual(data.files.filter(file => file.status === "complete").map(file => ({
      path: file.path, content: file.content, session_id: file.session_id,
    })), [{ path: "src/index.js", content: sources[0].entry, session_id: alice.sessionId }]);
    assert.equal(data.files.find(file => file.path === "src/alice.js").status, "in_progress");
    assert.equal(data.files.some(file => file.path === "src/bob.js"), false);

    const save = await request("/save-file", alice.cookie, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_path: "src/index.js", concept_name_en: "Entrypoint", content: "console.log('overwrite');\n" }),
    });
    assert.equal(save.status, 409);
    const reloaded = await request("/project-structure", alice.cookie);
    assert.equal(reloaded.status, 200);
    assert.equal((await reloaded.json()).files.find(file => file.path === "src/index.js").content, sources[0].entry);
  });
});