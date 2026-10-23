import { useLayoutEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { Empty, Pagination, Table, type PaginationProps, type TableProps } from 'antd';
import './viewport-table.css';

type ViewportTableProps<T extends object> = Omit<
  TableProps<T>,
  'pagination' | 'scroll' | 'locale'
> & {
  scrollX: number;
  pagination: PaginationProps;
  empty?: ReactNode;
};

/** A bounded table: measured body scroll, fixed header/pagination, viewport-centered empty state. */
export function ViewportTable<T extends object>({
  scrollX,
  pagination,
  empty,
  ...props
}: ViewportTableProps<T>) {
  const isLoading =
    typeof props.loading === 'object' ? props.loading.spinning !== false : props.loading;
  const viewport = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState({ body: 1, header: 0 });
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => {
      const header = element.querySelector('.ant-table-thead')?.getBoundingClientRect().height ?? 0;
      // Reserve the tokenized horizontal scrollbar so it never crowds the pagination.
      const scrollbar =
        parseFloat(getComputedStyle(element).getPropertyValue('--scroll-size')) || 0;
      const body = Math.max(1, element.clientHeight - header - scrollbar);
      setGeometry((old) => (old.body === body && old.header === header ? old : { body, header }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [props.columns]);
  return (
    <div
      className="viewport-table"
      style={{ '--viewport-table-body-height': `${geometry.body}px` } as CSSProperties}
    >
      <div ref={viewport} className="viewport-table-area admin-module-scroll">
        <Table<T>
          {...props}
          scroll={{ x: scrollX, y: geometry.body }}
          pagination={false}
          locale={{
            emptyText: (
              <div className="viewport-table-empty" role="status">
                {isLoading
                  ? '正在加载数据…'
                  : (empty ?? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
                    ))}
              </div>
            ),
          }}
        />
      </div>
      <Pagination className="viewport-table-pagination" {...pagination} />
    </div>
  );
}
