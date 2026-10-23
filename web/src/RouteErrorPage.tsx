import { useRouteError } from 'react-router-dom';
import './styles/route-error.css';

/** Kept outside lazy pages so a failed page module can still offer recovery. */
export function RouteErrorPage() {
  const error: unknown = useRouteError();
  const resourceFailure =
    error instanceof Error &&
    /dynamically imported module|loading chunk|module script/i.test(error.message);
  const adminPage = window.location.pathname.startsWith('/admin');
  return (
    <main className="route-error-page">
      <section role="alert">
        <h1>{resourceFailure ? '页面资源加载失败' : '页面暂时无法显示'}</h1>
        <p>
          {resourceFailure
            ? '请重新加载页面后继续。如果仍无法打开，请联系管理员。'
            : '请重新加载后重试；如果问题持续出现，请联系管理员。'}
        </p>
        <div className="route-error-actions">
          <button type="button" onClick={() => window.location.reload()}>
            重新加载页面
          </button>
          {adminPage && (
            <a
              href={
                window.location.pathname === '/admin/review' ? '/admin/guests' : '/admin/review'
              }
            >
              {window.location.pathname === '/admin/review' ? '进入宾客查询' : '进入现场审核'}
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
