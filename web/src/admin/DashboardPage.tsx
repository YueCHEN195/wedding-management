import { useDashboard } from './dashboard/useDashboard';
import { DashboardView } from './dashboard/Dashboard.view';
export function DashboardPage() {
  const model = useDashboard();
  return <DashboardView model={model} />;
}
