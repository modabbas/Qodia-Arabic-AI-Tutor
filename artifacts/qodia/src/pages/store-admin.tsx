import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { getStoreInterest, type StoreInterestEntry } from '@workspace/api-client-react';
import { StoreLayout } from '@/components/store/StoreChrome';
import { errorStatus, formatDate } from '@/components/store/store-utils';

type State =
  | { kind: 'missing-key' }
  | { kind: 'loading' }
  | { kind: 'not-configured' }
  | { kind: 'invalid' }
  | { kind: 'error' }
  | { kind: 'ready'; rows: StoreInterestEntry[] };

function readAndStripKey(): string | null {
  const url = new URL(window.location.href);
  const key = url.searchParams.get('key');
  if (url.searchParams.has('key')) {
    url.searchParams.delete('key');
    window.history.replaceState(window.history.state, '', url.pathname + (url.search || '') + url.hash);
  }
  return key && key.trim() ? key.trim() : null;
}

export default function StoreAdmin() {
  const [keyValue] = useState<string | null>(() => (typeof window === 'undefined' ? null : readAndStripKey()));
  const [state, setState] = useState<State>(() => (keyValue ? { kind: 'loading' } : { kind: 'missing-key' }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
    const created = !meta;
    const previous = meta?.content ?? '';
    if (!meta) { meta = document.createElement('meta'); meta.name = 'referrer'; document.head.appendChild(meta); }
    meta.content = 'no-referrer';
    return () => { if (created) meta?.remove(); else if (meta) meta.content = previous; };
  }, []);

  useEffect(() => {
    if (!keyValue) return;
    let active = true;
    const controller = new AbortController();
    setState({ kind: 'loading' });
    getStoreInterest({ key: keyValue }, { cache: 'no-store', referrerPolicy: 'no-referrer', signal: controller.signal })
      .then((rows) => { if (active) setState({ kind: 'ready', rows: Array.isArray(rows) ? rows : [] }); })
      .catch((err) => {
        if (!active) return;
        const status = errorStatus(err);
        if (status === 503) setState({ kind: 'not-configured' });
        else if (status === 401 || status === 403 || status === 400) setState({ kind: 'invalid' });
        else setState({ kind: 'error' });
      });
    return () => { active = false; controller.abort(); };
  }, [keyValue, attempt]);

  return (
    <StoreLayout current="admin">
      <section className="qp-shell st-admin" aria-labelledby="admin-title">
        <span className="qp-kicker kicker-amber"><i /> صفحة إدارية محمية</span>
        <h1 id="admin-title">طلبات الاهتمام بالمتجر</h1>

        {state.kind === 'missing-key' && <AdminNote title="مفتاح الوصول مفقود." text="افتح هذه الصفحة عبر الرابط الإداري الذي يحتوي مفتاح الوصول. لا تُعرض أي بيانات تواصل بدونه." />}
        {state.kind === 'not-configured' && <AdminNote title="الحماية غير مُعدّة على الخادم." text="لم يُضبط المتغير ADMIN_KEY في بيئة الخادم، لذلك الصفحة مغلقة." />}
        {state.kind === 'invalid' && <AdminNote title="مفتاح الوصول غير صحيح." text="تحقق من الرابط الإداري ثم أعد فتحه." />}
        {state.kind === 'error' && (
          <div className="st-state" role="alert" data-testid="status-error">
            <strong>تعذّر تحميل الطلبات.</strong>
            <button type="button" className="qp-button qp-button-quiet" onClick={() => setAttempt((a) => a + 1)} data-testid="button-retry">حاول مجددًا</button>
          </div>
        )}
        {state.kind === 'loading' && <div role="status" aria-label="جارٍ التحميل" data-testid="status-loading"><div className="skeleton" style={{ height: 220, marginTop: 28 }} /></div>}
        {state.kind === 'ready' && state.rows.length === 0 && <div className="st-state" data-testid="status-empty"><strong>لا طلبات اهتمام بعد.</strong></div>}
        {state.kind === 'ready' && state.rows.length > 0 && (
          <div className="st-table-wrap">
            <table className="st-table" data-testid="table-interest">
              <caption className="st-count-line">{state.rows.length} طلب</caption>
              <thead><tr><th scope="col">المشروع</th><th scope="col">الاسم</th><th scope="col">التواصل</th><th scope="col">النوع</th><th scope="col">التاريخ</th><th scope="col">ملاحظة</th></tr></thead>
              <tbody>
                {state.rows.map((r) => (
                  <tr key={r.id} data-testid={`row-interest-${r.id}`}>
                    <td>{r.project_title}</td>
                    <td>{r.name}</td>
                    <td dir="ltr" className="st-td-contact">{r.email_or_phone}</td>
                    <td>{r.type === 'institute' ? 'معهد' : 'طالب'}</td>
                    <td>{formatDate(r.created_at)}</td>
                    <td className="st-td-note">{r.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </StoreLayout>
  );
}

function AdminNote({ title, text }: { title: string; text: string }) {
  return <div className="st-state" role="alert" data-testid="status-auth"><Lock size={20} aria-hidden="true" /><strong>{title}</strong><p>{text}</p></div>;
}
