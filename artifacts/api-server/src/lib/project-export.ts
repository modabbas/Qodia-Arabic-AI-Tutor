import { deflateRawSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { extname, posix } from "node:path";
import { build, transform, type Plugin } from "esbuild";
import type { ProjectTechStack } from "./project-builder";

export type SourceFile = { path: string; content: string };
export type VerificationIssue = { path: string; line: number | null; message: string };
export type VerificationReport = {
  status: "failed" | "passed" | "unavailable";
  check: string;
  checked_files: number;
  issues: VerificationIssue[];
  note: string;
};

// Never materialize student code on the server or run its install/build scripts.
const safePath = /^(?!.*(?:^|\/)\.\.?($|\/))[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;
const maxFiles = 40;
const maxTotalBytes = 1_500_000;

export function assembleProject(files: SourceFile[], tech: ProjectTechStack, projectName: string) {
  const entries = new Map<string, string>();
  let bytes = 0;
  for (const file of files) {
    if (!safePath.test(file.path) || file.path.length > 240 || entries.has(file.path.toLowerCase())) {
      throw new Error("Invalid or duplicate saved project path");
    }
    bytes += Buffer.byteLength(file.content);
    if (bytes > maxTotalBytes || entries.size >= maxFiles) throw new Error("Project export exceeds size limit");
    entries.set(file.path.toLowerCase(), file.content);
  }
  const output = new Map<string, string>(files.map(file => [file.path, file.content]));
  const add = (path: string, content: string) => {
    if (!entries.has(path.toLowerCase())) {
      entries.set(path.toLowerCase(), content);
      output.set(path, content);
    }
  };
  const title = projectName.replace(/[\r\n]/g, " ").slice(0, 120);
  add(".gitignore", "node_modules/\ndist/\n.env\n.venv/\n__pycache__/\n*.pyc\n.dart_tool/\nbuild/\n");
  if (tech === "React") {
    add("package.json", JSON.stringify({ name: "student-react-project", private: true, type: "module", scripts: { dev: "vite", build: "vite build" }, dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" }, devDependencies: { vite: "^7.0.0" } }, null, 2) + "\n");
    add("vite.config.js", "import { defineConfig } from 'vite';\nexport default defineConfig({});\n");
  } else if (tech === "Node.js") {
    add("package.json", JSON.stringify({ name: "student-node-project", private: true, type: "module", scripts: { start: "node src/index.js" }, dependencies: { express: "^5.0.0" } }, null, 2) + "\n");
  } else if (tech === "Django") {
    add("requirements.txt", "Django>=5.2,<6\n");
  } else {
    add("pubspec.yaml", "name: student_flutter_project\ndescription: A student Flutter project\npublish_to: none\nversion: 1.0.0+1\nenvironment:\n  sdk: '>=3.5.0 <4.0.0'\ndependencies:\n  flutter:\n    sdk: flutter\nflutter:\n  uses-material-design: true\n");
  }
  const added = [...output.keys()].filter(path => !files.some(file => file.path === path));
  if (!entries.has("readme.md")) added.push("README.md");
  add("README.md", `# ${title}\n\nStack: ${tech}\n\nThis export contains ${files.length} saved student-written file(s). The following setup files were added only when absent: ${added.join(", ") || "none"}.\nPlanned files not yet saved are not included. Generated setup files are not student-written code.\n\nInstall the dependencies declared by this project using the appropriate toolchain, then run its checks locally. Kodia's syntax check does not prove that this project builds or runs.\n`);
  return [...output].map(([path, content]) => ({ path, content }));
}

export async function verifyProject(files: SourceFile[], tech: ProjectTechStack): Promise<VerificationReport> {
  const issues: VerificationIssue[] = [];
  let checked = 0;
  if (tech === "Flutter") {
    return { status: "unavailable", check: "Flutter / Dart", checked_files: 0, issues: [], note: "فحص Dart/Flutter غير متاح بأمان على الخادم. شغّل flutter analyze و flutter build محلياً بعد تنزيل المشروع." };
  }
  if (tech === "Django") {
    const pythonFiles = files.filter(f => f.path.endsWith(".py"));
    const result = spawnSync("python3", ["-I", "-c", "import ast,json,sys\nfor f in json.load(sys.stdin):\n try: ast.parse(f['content'],filename=f['path'])\n except SyntaxError as e: print(json.dumps({'path':f['path'],'line':e.lineno,'message':e.msg}))"], {
      input: JSON.stringify(pythonFiles), encoding: "utf8", timeout: 5000, maxBuffer: 65536,
    });
    if (result.error || result.status !== 0) {
      return { status: "unavailable", check: "Python syntax", checked_files: 0, issues: [], note: "تعذر تشغيل محلل Python بأمان. شغّل python -m compileall محلياً." };
    }
    checked = pythonFiles.length;
    for (const line of result.stdout.trim().split("\n").filter(Boolean)) {
      const error = JSON.parse(line) as VerificationIssue;
      issues.push(error);
    }
  } else {
    for (const file of files) {
      const extension = extname(file.path);
      if (extension === ".json") {
        checked++;
        try { JSON.parse(file.content); }
        catch (error) { issues.push({ path: file.path, line: null, message: error instanceof Error ? error.message : "Invalid JSON" }); }
      } else if ([".js", ".jsx", ".ts", ".tsx", ".css"].includes(extension)) {
        checked++;
        try {
          await transform(file.content, { sourcefile: file.path, loader: extension.slice(1) as "js" | "jsx" | "ts" | "tsx" | "css", logLevel: "silent" });
        } catch (error) {
          const details = (error as { errors?: { text: string; location?: { line: number } }[] }).errors;
          for (const detail of details ?? []) issues.push({ path: file.path, line: detail.location?.line ?? null, message: detail.text });
          if (!details?.length) issues.push({ path: file.path, line: null, message: "تعذر تحليل صياغة الملف." });
        }
      }
    }
    // Bundle only saved source in memory. Bare package imports stay external:
    // never read or execute user-provided config, package scripts, or dependencies.
    const entry = tech === "React" ? "src/main.jsx" : "src/index.js";
    const map = new Map(files.map(file => [file.path, file.content]));
    if (map.has(entry) && !issues.length) {
      const plugin: Plugin = {
        name: "saved-source-only",
        setup(api) {
          api.onResolve({ filter: /.*/ }, args => {
            if (args.path.startsWith("project:")) return { path: args.path.slice(8), namespace: "saved" };
            if (!args.path.startsWith(".") && !args.path.startsWith("/")) return { path: args.path, external: true };
            if (args.path.startsWith("/")) return { errors: [{ text: "Absolute imports cannot be checked in the saved project" }] };
            const base = posix.normalize(posix.join(posix.dirname(args.importer), args.path));
            const match = [base, `${base}.js`, `${base}.jsx`, `${base}.ts`, `${base}.tsx`, `${base}.json`, `${base}.css`, `${base}.svg`, `${base}/index.js`, `${base}/index.jsx`].find(path => map.has(path));
            return match ? { path: match, namespace: "saved" } : { errors: [{ text: `Missing saved local import: ${args.path}` }] };
          });
          api.onLoad({ filter: /.*/, namespace: "saved" }, args => {
            const content = map.get(args.path);
            if (content === undefined) return { errors: [{ text: "Saved file is missing" }] };
            const ext = extname(args.path).slice(1);
            return { contents: content, loader: ext === "svg" ? "dataurl" : ["jsx", "tsx", "ts", "json", "css"].includes(ext) ? ext as "jsx" | "tsx" | "ts" | "json" | "css" : "js" };
          });
        },
      };
      try {
        await build({ entryPoints: [`project:${entry}`], bundle: true, write: false, logLevel: "silent",
          platform: tech === "React" ? "browser" : "node", format: "esm", plugins: [plugin], });
      } catch (error) {
        for (const detail of (error as { errors?: { text: string; location?: { file?: string; line: number } }[] }).errors ?? []) {
          issues.push({ path: detail.location?.file ?? entry, line: detail.location?.line ?? null, message: detail.text });
        }
        if (!issues.length) issues.push({ path: entry, line: null, message: "تعذر تجميع الملفات المحلية." });
      }
    } else if (!map.has(entry)) {
      issues.push({ path: entry, line: null, message: "ملف بدء المشروع لم يُحفظ بعد؛ لا يمكن فحص تجميع الملفات المحلية." });
    }
  }
  const check = tech === "Django" ? "Python syntax" : tech === "React" ? "React / JavaScript syntax" : "Node.js / JavaScript syntax";
  return {
    status: issues.length ? "failed" : checked ? "passed" : "unavailable",
    check, checked_files: checked, issues: issues.slice(0, 30),
    note: issues.length
      ? "أصلح الأخطاء في الملفات المشار إليها ثم أعد الفحص. الملفات المكتملة للقراءة فقط؛ راجعها في مشروعك المصدر."
      : checked ? tech === "Django"
        ? "اجتاز فحص صياغة Python فقط. لم يُشغّل Django أو تثبيت الاعتماديات أو الاختبارات؛ لا يمكن تأكيد نجاح البناء."
        : "اجتازت الملفات فحص الصياغة وتجميع الاستيرادات المحلية في الذاكرة. لم يُشغّل تثبيت الاعتماديات أو بناء الإطار الكامل أو اختباراته؛ لا يمكن تأكيد نجاح البناء."
        : "لا توجد ملفات مصدر قابلة للفحص بعد. لم يُجرَ بناء للمشروع.",
  };
}

export async function verifySubmittedFile(path: string, content: string, tech: ProjectTechStack): Promise<boolean> {
  const extension = extname(path);
  if (tech === "Flutter") return false;
  if (tech === "Django") {
    if (extension !== ".py") return false;
    const result = spawnSync("python3", ["-I", "-c", "import ast,sys\nast.parse(sys.stdin.read())"], {
      input: content,
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 65536,
    });
    return !result.error && result.status === 0;
  }
  if (extension === ".json") {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }
  if (![".js", ".jsx", ".ts", ".tsx", ".css"].includes(extension)) return false;
  try {
    await transform(content, {
      sourcefile: path,
      loader: extension.slice(1) as "js" | "jsx" | "ts" | "tsx" | "css",
      logLevel: "silent",
    });
    return true;
  } catch {
    return false;
  }
}

const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let value = i;
  for (let n = 0; n < 8; n++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  return value >>> 0;
});
function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 255]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function zipProject(files: SourceFile[]): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const file of files) {
    if (!safePath.test(file.path) || file.path.length > 240) throw new Error("Unsafe ZIP path");
    const name = Buffer.from(file.path);
    const data = Buffer.from(file.content);
    const compressed = deflateRawSync(data);
    const crc = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x800, 8);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(compressed.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += header.length + name.length + compressed.length;
  }
  const directorySize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}