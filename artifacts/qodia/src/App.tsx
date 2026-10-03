import { useEffect, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { getGetCurrentUserQueryKey, useGetCurrentUser } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ErrorState, LoadingState } from '@/components/qodia-ui';
import Landing from '@/pages/landing';
import AuthPage from '@/pages/auth';
import Onboarding from '@/pages/onboarding';
import Dashboard from '@/pages/dashboard';
import MyProject from '@/pages/my-project';
import Session from '@/pages/session';
import FinalDefense from '@/pages/final-defense';
import TryAnyField from '@/pages/try-any-field';
import UniversityDashboard from '@/pages/university-dashboard';
import CompanyDashboard from '@/pages/company-dashboard';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 60_000, refetchOnWindowFocus: false } } });
const pageMetadata: Record<string, { title: string; description: string }> = {
  '/': { title: 'كوديا — لا ترسب في المناقشة', description: 'تدرّب على فهم مشروع تخرجك والدفاع عن قراراتك التقنية بخمس لمسات عربية.' },
  '/signup': { title: 'أنشئ حسابك | كوديا', description: 'ابدأ تدريبك على مناقشة مشروع التخرج مع كوديا.' },
  '/login': { title: 'تسجيل الدخول | كوديا', description: 'ارجع إلى تدريبك وتقدّمك في كوديا.' },
  '/onboarding': { title: 'عرّفنا على مشروعك | كوديا', description: 'أخبر كوديا عن مشروعك والتقنية التي تستخدمها لتبدأ التدريب.' },
  '/dashboard': { title: 'لوحة تقدّمك | كوديا', description: 'تابع نقاط الخبرة وسلسلة التدريب وجلساتك السابقة في كوديا.' },
  '/my-project': { title: 'مشروعي | كوديا', description: 'راجع ملفات مشروع تخرجك الحقيقية، الكود المحفوظ، وتقدم البناء في كوديا.' },
  '/session': { title: 'تدريب المناقشة | كوديا', description: 'طبّق مفاهيم التقنية التي اخترتها ودافع عن قراراتك عبر خمس لمسات تفاعلية.' },
  '/final-defense': { title: 'المناقشة النهائية | كوديا', description: 'محاكاة مناقشة افتراضية من خمسة أسئلة عن ملفات مشروعك ومفاهيمك المتعلَّمة.' },
  '/try-any-field': { title: 'جرّب أي مجال | كوديا', description: 'جرّب منهجية الخمس لمسات بالعربية في الطب والهندسة وأي مجال جامعي، دون حساب أو حفظ تقدّم.' },
  '/university-dashboard': { title: 'لوحة الجامعة | كوديا', description: 'نظرة تجريبية على تقدم الطلاب وجاهزيتهم للتوظيف في كوديا.' },
  '/company-dashboard': { title: 'لوحة الشركات | كوديا', description: 'استكشف مرشحين تجريبيين ومؤشرات Talent Bridge في كوديا.' },
};

function RouteMetadata() {
  const [location] = useLocation();
  useEffect(() => {
    const details = pageMetadata[location] ?? { title: 'الصفحة غير موجودة | كوديا', description: 'ارجع إلى كوديا لتبدأ تدريبك على مناقشة مشروع التخرج.' };
    document.title = details.title;
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      document.querySelector(selector)?.setAttribute('content', details.description);
    }
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      document.querySelector(selector)?.setAttribute('content', details.title);
    }
    document.querySelector('meta[name="robots"]')?.setAttribute('content', location === '/' ? 'index, follow' : 'noindex, follow');
  }, [location]);
  return null;
}

function Guard({ children, onboarding = false }: { children: ReactNode; onboarding?: boolean }) {
  const [, navigate] = useLocation();
  const current = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  const unauthorized = current.isError && (current.error as Error & { status?: number })?.status === 401;
  useEffect(() => {
    if (unauthorized) navigate('/login');
    else if (current.data?.user && !onboarding && !current.data.user.project_name) navigate('/onboarding');
    else if (current.data?.user?.project_name && onboarding) navigate('/dashboard');
  }, [unauthorized, current.data?.user, onboarding, navigate]);
  if (current.isLoading || unauthorized || current.data?.user && ((!onboarding && !current.data.user.project_name) || (onboarding && !!current.data.user.project_name))) return <LoadingState label="نجهّز طريقك للتدريب..." />;
  if (current.isError || !current.data?.user) return <ErrorState retry={() => { void current.refetch(); }} text="ما قدرنا نتأكد من حسابك. تأكد من اتصالك وحاول مرة ثانية." />;
  return <>{children}</>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppRoutes() {
  return <RoutedErrorBoundary><Switch>
    <Route path="/" component={Landing} />
    <Route path="/signup">{() => <AuthPage mode="signup" />}</Route>
    <Route path="/login">{() => <AuthPage mode="login" />}</Route>
    <Route path="/onboarding">{() => <Guard onboarding><Onboarding /></Guard>}</Route>
    <Route path="/dashboard">{() => <Guard><Dashboard /></Guard>}</Route>
    <Route path="/my-project">{() => <Guard><MyProject /></Guard>}</Route>
    <Route path="/session">{() => <Guard><Session /></Guard>}</Route>
    <Route path="/final-defense">{() => <Guard><FinalDefense /></Guard>}</Route>
    <Route path="/try-any-field" component={TryAnyField} />
    {/* Demo only: before connecting real student data, restrict access to university_admin. */}
    <Route path="/university-dashboard" component={UniversityDashboard} />
    {/* Demo only: require authorized company access before showing real candidate data. */}
    <Route path="/company-dashboard" component={CompanyDashboard} />
    <Route component={NotFound} />
  </Switch></RoutedErrorBoundary>;
}

function App() {
  useEffect(() => { document.documentElement.dir = 'rtl'; document.documentElement.lang = 'ar'; document.documentElement.classList.add('dark'); }, []);
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><RouteMetadata /><AppRoutes /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;