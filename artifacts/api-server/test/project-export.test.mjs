import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { assembleProject, verifyProject, zipProject } from "../src/lib/project-export.ts";

test("ZIP preserves saved files verbatim and marks generated scaffolding", () => {
  const source = [{ path: "src/main.jsx", content: "export default 'student work';\n" }];
  const archive = zipProject(assembleProject(source, "React", "Example"));
  const result = spawnSync("python3", ["-c", "import sys,zipfile,io,json\nz=zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))\nprint(json.dumps({n:z.read(n).decode() for n in z.namelist()}))"], {
    input: archive, encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const extracted = JSON.parse(result.stdout);
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