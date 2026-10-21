import { ExportsView } from './exports/Exports.view';
import { useExportsPage } from './exports/useExportsPage';
export function ExportPage() {
  const model = useExportsPage();
  return <ExportsView model={model} />;
}
