import ReactEChartsCore from 'echarts-for-react/esm/core';
import * as echarts from 'echarts/core';
import { PieChart } from 'echarts/charts';
import { AriaComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { dashboardChart as chart } from './dashboardTokens';
echarts.use([PieChart, AriaComponent, TooltipComponent, CanvasRenderer]);

export function RsvpRing({
  items,
  reducedMotion,
}: {
  items: { label: string; value: number; color: string }[];
  reducedMotion: boolean;
}) {
  return (
    <ReactEChartsCore
      echarts={echarts}
      className="dashboard-ring"
      style={{ height: 'var(--dash-ring-height)' }}
      notMerge
      option={{
        animation: !reducedMotion,
        animationDuration: chart.motion.enter,
        animationDurationUpdate: chart.motion.update,
        aria: { enabled: true },
        tooltip: { trigger: 'item', renderMode: 'richText', formatter: '{b}：{c} 份（{d}%）' },
        series: [
          {
            type: 'pie',
            radius: [chart.ring.inner, chart.ring.outer],
            center: chart.ring.center,
            padAngle: chart.ring.gap,
            itemStyle: { borderColor: chart.colors.surface, borderWidth: chart.ring.border },
            label: { show: false },
            labelLine: { show: false },
            emphasis: { scale: false },
            data: items.map((x) => ({
              name: x.label,
              value: x.value,
              itemStyle: { color: x.color },
            })),
          },
        ],
      }}
    />
  );
}
