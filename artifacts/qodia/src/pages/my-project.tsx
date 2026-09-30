import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, ChevronDown, Clock3, Download, FolderTree, GitCommitHorizontal, ScanSearch } from 'lucide-react';
import { Link } from 'wouter';
import { getProjectVerification, useGetProjectStructure, type ProjectPlanFile, type ProjectVerification } from '@workspace/api-client-react';
import { AppHeader, ErrorState, LoadingState } from '@/components/qodia-ui';
import './my-project.css';

type TreeNode = { name: string; path: string; children: TreeNode[]; file?: ProjectPlanFile };

const statusLabels = { complete: 'مكتمل', in_progress: 'قيد العمل', planned: 'مخطط له' } as const;
const statusIcons = { complete: '✅', in_progress: '🟡', planned: '⚪' } as const;

function makeTree(files: ProjectPlanFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  files.forEach(file => {
    let level = root;
    let path = '';
    const parts = file.path.split('/');
    parts.forEach((part, index) => {
      path = path ? `${path}/${part}` : part;
      let node = level.find(item => item.name === part);
      if (!node) {
        node = { name: part, path, children: [], ...(index === parts.length - 1 ? { file } : {}) };
        level.push(node);
      }
      level = node.children;
    });
  });
  return root;
}

function languageFor(path: string) {
  const ext = path.split('.').pop()?.toLowerCase();
  const names: Record<string, string> = {
    py: 'Python', js: 'JavaScript', jsx: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript',
    json: 'JSON', html: 'HTML', htm: 'HTML', css: 'CSS', scss: 'SCSS',
    sql: 'SQL', md: 'Markdown', java: 'Java', dart: 'Dart', yml: 'YAML', yaml: 'YAML',
  };
  return names[ext ?? ''] ?? 'نص';
}

function highlightedLine(line: string, path: string) {
  const python = path.toLowerCase().endsWith('.py');
  const pattern = python
    ? /#[^\n]*|(?:'''[\s\S]*?'''|"""[\s\S]*?"""|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(?:def|class|return|import|from|as|if|elif|else|for|in|while|try|except|finally|with|lambda|async|await|yield|raise|pass|None|True|False|self|not|and|or)\b|\b\d+(?:\.\d+)?\b/g
    : /\/\/.*|\/\*.*?\*\/|<!--.*?-->|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|<\/?[A-Za-z][^>]*?>|\b(?:const|let|var|function|return|export|default|import|from|class|new|async|await|if|else|for|while|try|catch|throw|interface|type|extends|public|private|true|false|null|undefined|this|super|SELECT|FROM|WHERE|CREATE|TABLE|INSERT|UPDATE|DELETE)\b|\b\d+(?:\.\d+)?\b/g;
  const output: ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) output.push(line.slice(last, index));
    const token = match[0];
    const kind = token.startsWith('//') || token.startsWith('#') || token.startsWith('/*') || token.startsWith('<!--') ? 'comment'
      : /^["'`]/.test(token) ? 'string'
      : token.startsWith('<') ? 'tag'
      : /^\d/.test(token) ? 'number' : 'keyword';
    output.push(<span className={`project-token-${kind}`} key={index}>{token}</span>);
    last = index + token.length;
  }
  if (last < line.length) output.push(line.slice(last));
  return output;
}

function FileTree({ nodes, selectedPath, onSelect, collapsed, onToggle, depth = 0 }: {
  nodes: TreeNode[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  depth?: number;
}) {
  return <>{nodes.map(node => node.file
    ? <button key={node.path} type="button" className={`project-tree-file ${selectedPath === node.path ? 'is-selected' : ''}`}
        style={{ paddingRight: 9 + depth * 17 }} onClick={() => onSelect(node.path)}
        aria-current={selectedPath === node.path ? 'true' : undefined}
        title={node.path} data-testid={`button-project-file-${node.path.replaceAll('/', '-')}`}>
        <span className="project-tree-emoji" aria-hidden="true">📄</span><span className="project-tree-file-name">{node.name}</span>
        <span className="project-tree-status" aria-label={statusLabels[node.file.status]} title={statusLabels[node.file.status]}>{statusIcons[node.file.status]}</span>
      </button>
    : <div key={node.path}>
        <button type="button" className="project-tree-folder" style={{ paddingRight: 9 + depth * 17 }}
          onClick={() => onToggle(node.path)} aria-expanded={!collapsed.has(node.path)}
          data-testid={`button-project-folder-${node.path.replaceAll('/', '-')}`}>
          <ChevronDown size={13} className={`project-tree-chevron ${collapsed.has(node.path) ? 'is-closed' : ''}`} aria-hidden="true" />
          <span className="project-tree-emoji" aria-hidden="true">📁</span><span className="project-tree-folder-name">{node.name}</span>
        </button>
        {!collapsed.has(node.path) && <FileTree nodes={node.children} selectedPath={selectedPath} onSelect={onSelect} collapsed={collapsed} onToggle={onToggle} depth={depth + 1} />}
      </div>)}</>;
}

export default function MyProject() {
  const project = useGetProjectStructure();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [verification, setVerification] = useState<ProjectVerification | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [actionError, setActionError] = useState('');
  const check = async () => {
    setChecking(true);
    setActionError('');
    try { setVerification(await getProjectVerification()); }
    catch { setActionError('تعذر فحص المشروع. تأكد من اتصالك ثم حاول مجدداً.'); }
    finally { setChecking(false); }
  };
  const download = async () => {
    setDownloading(true);
    setActionError('');
    try {
      const response = await fetch('/api/project-export', { credentials: 'same-origin' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? 'تعذر تنزيل المشروع. حاول مجدداً.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'kodia-project.zip';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'تعذر تنزيل المشروع.');
    } finally { setDownloading(false); }
  };
  const files = project.data?.files;
  const tree = useMemo(() => makeTree(files ?? []), [files]);
  if (project.isLoading) return <div className="min-h-[100dvh]"><AppHeader /><LoadingState label="نفتح ملفات مشروعك..." /></div>;
  if (project.isError || !project.data) return <div className="min-h-[100dvh]"><AppHeader /><ErrorState retry={() => { void project.refetch(); }} text="ما قدرنا نحمّل ملفات مشروعك. تأكد من اتصالك وحاول مرة ثانية." /></div>;

  const data = project.data;
  const selected = data.files.find(file => file.path === selectedPath) ?? data.files.find(file => file.content !== null) ?? data.files[0];
  const total = data.total_files || 30;
  const toggleFolder = (path: string) => setCollapsed(previous => {
    const next = new Set(previous);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });

  return <div className="min-h-[100dvh]">
    <AppHeader />
    <main className="shell project-page">
      <Link href="/dashboard" className="project-back" data-testid="link-project-back"><ArrowRight size={15} /> العودة إلى لوحتي</Link>
      <div className="project-intro">
        <div><span className="eyebrow">مساحة المشروع / ملفاتك الحقيقية</span><h1 data-testid="text-project-title">{data.project_name}</h1><p>هذا ما بُني في مشروعك حتى الآن. افتح أي ملف لتراجع الكود الذي حفظته بنفسك، وتتبّع ما سيأتي بعده.</p></div>
        {data.tech_stack && <span className="project-tech" data-testid="text-project-tech">{data.tech_stack}</span>}
      </div>

      <div className="project-overview">
        <section className="project-progress" aria-label="تقدم ملفات المشروع">
          <div className="project-progress-head">
            <div><span className="eyebrow">من الفكرة إلى المشروع</span><h2>تقدّم البناء</h2><p>يُحتسب فقط ما اكتمل من ملفات مشروعك، وليس المفاهيم التي درستها سابقاً.</p></div>
            <div className="project-progress-number" data-testid="text-project-progress">{data.completed_files}<small> / {total}</small></div>
          </div>
          <div className="project-progress-track" role="progressbar" aria-label="الملفات المكتملة" aria-valuemin={0} aria-valuemax={total} aria-valuenow={data.completed_files}>
            <div className="project-progress-fill" style={{ width: `${Math.min(100, Math.max(0, data.completed_files / total * 100))}%` }} />
          </div>
          <div className="project-legend"><span>✅ مكتمل</span><span>🟡 قيد العمل</span><span>⚪ مخطط له</span></div>
        </section>
        <section className="project-summary-card"><strong>عن مشروعك</strong><p data-testid="text-project-summary">{data.project_summary || 'وصف المشروع سيظهر هنا حين يصبح متاحاً.'}</p></section>
      </div>

      <section className="project-delivery" aria-label="تنزيل وفحص المشروع">
        <div><span className="eyebrow">ملفاتك المحفوظة</span><h2>نزّل مشروعك وافحصه</h2>
          <p>الملف المضغوط يحتوي على كودك المحفوظ فقط مع ملفات إعداد أساسية عند غيابها. الملفات المخططة لم تُكتب بعد ولن تظهر كأنها من إنجازك.</p></div>
        <div className="project-delivery-actions">
          <button type="button" className="btn btn-outline" onClick={() => { void check(); }} disabled={checking || downloading} data-testid="button-project-verify"><ScanSearch size={16} /> {checking ? 'جارٍ الفحص...' : 'افحص الصياغة'}</button>
          <button type="button" className="btn btn-primary" onClick={() => { void download(); }} disabled={!data.files.some(file => file.content !== null) || downloading} data-testid="button-project-download"><Download size={16} /> {downloading ? 'جارٍ التجهيز...' : 'نزّل ZIP'}</button>
        </div>
        {actionError && <p className="project-delivery-error" role="alert">{actionError}</p>}
        {verification && <div className={`project-verification ${verification.status}`} role="status" data-testid="project-verification">
          <strong>{verification.status === 'failed' ? 'توجد أخطاء في الصياغة' : verification.status === 'passed' ? 'اجتاز فحص الصياغة' : 'الفحص غير متاح لهذه التقنية'}</strong>
          <p>{verification.check} · {verification.checked_files} ملف تم فحصه. {verification.note}</p>
          {verification.issues.length > 0 && <ul dir="ltr">{verification.issues.map((issue, index) => <li key={`${issue.path}-${index}`}><bdi>{issue.path}{issue.line ? `:${issue.line}` : ''}</bdi> — {issue.message}</li>)}</ul>}
        </div>}
        <p className="project-delivery-caveat">فحص الصياغة ليس بناءً أو تشغيلًا للمشروع. لم نتحقق من نجاح التجميع أو الاعتماديات؛ شغّل أدوات البناء محلياً بعد التنزيل.</p>
      </section>

      <section className="project-workspace" aria-label="ملفات المشروع">
        <aside className="project-sidebar">
          <div className="project-sidebar-head"><h2>هيكل الملفات</h2><p data-testid="text-project-file-count">{data.files.length} ملف في الخطة</p></div>
          {tree.length ? <div className="project-tree"><FileTree nodes={tree} selectedPath={selected?.path ?? null} onSelect={setSelectedPath} collapsed={collapsed} onToggle={toggleFolder} /></div>
            : <div className="project-code-empty"><FolderTree size={24} /><strong>الشجرة لسا فاضية</strong><p>ملفات مشروعك رح تظهر هون لما تبدأ تبنيها في الجلسات.</p></div>}
        </aside>
        <div className="project-detail">
          {selected ? <>
            <div className="project-file-head">
              <div className="project-file-top"><div><span className="eyebrow">ملف المشروع</span><h2 data-testid="text-selected-file-path">{selected.path}</h2></div><span className={`project-status ${selected.status}`} data-testid="text-selected-file-status">{statusIcons[selected.status]} {statusLabels[selected.status]}</span></div>
              <p className="project-file-desc">{selected.description}</p>
              <div className="project-file-meta">
                <span><Clock3 size={13} /> اليوم {selected.day}</span>
                <span>المفهوم: {selected.concept}</span>
                {selected.session_id && <span><GitCommitHorizontal size={14} /> جلسة <bdi className="mono" data-testid="text-selected-session-id">{selected.session_id}</bdi></span>}
                {!selected.session_id && <span>لم يُربط بجلسة بعد</span>}
              </div>
            </div>
            {selected.content !== null ? <>
              <div className="project-code-toolbar"><span>{languageFor(selected.path)}</span><span>للقراءة فقط · محتوى محفوظ</span></div>
              {selected.content.length ? <div className="project-code" role="region" aria-label={`الكود المحفوظ في ${selected.path}`} data-testid="code-project-content">{selected.content.split('\n').map((line, index) =>
                <div className="project-code-line" key={index}><span className="project-line-number" aria-hidden="true">{index + 1}</span><code>{highlightedLine(line, selected.path)}</code></div>)}</div>
                : <div className="project-code-empty" data-testid="status-empty-file"><strong>الملف محفوظ لكنه فارغ.</strong><p>ما فيه أي كود لعرضه حالياً.</p></div>}
            </> : <div className="project-code-empty" data-testid="status-file-not-written"><FolderTree size={25} style={{ marginBottom: 15, color: '#70ae7c' }} /><strong>الكود لسا ما انكتب.</strong><p>{selected.status === 'planned' ? 'هذا الملف جزء من خطة مشروعك. لما تكتبه وتحفظه خلال جلسة، رح يظهر محتواه الحقيقي هون.' : 'هذا الملف قيد العمل. رح يظهر الكود هون بعد حفظه في جلسة.'}</p></div>}
          </> : <div className="project-code-empty"><strong>ما في ملفات لعرضها بعد.</strong><p>ابدأ جلسة تدريب، وارجع لمراجعة ما بنيته في مشروعك.</p><Link href="/session" className="btn btn-outline" style={{ marginTop: 20 }} data-testid="link-project-start-session">ابدأ جلسة</Link></div>}
        </div>
      </section>

      <section className="project-history" aria-label="المفاهيم التي تعلمتها">
        <span className="eyebrow">سجل التعلّم</span><h2>مفاهيم مرّيت عليها</h2>
        <p>تاريخ تعلّمك منفصل عن ملفات المشروع المكتملة؛ دراسة مفهوم لا تعني أن ملفه قد كُتب.</p>
        {data.learned_concepts.length
          ? <div className="project-history-tags" data-testid="list-learned-concepts">{data.learned_concepts.map((concept, index) => <span key={`${concept}-${index}`}>{concept}</span>)}</div>
          : <p data-testid="status-no-learned-concepts">بعد أول جلسة، رح تلاقي المفاهيم التي درستها هون.</p>}
      </section>
    </main>
  </div>;
}