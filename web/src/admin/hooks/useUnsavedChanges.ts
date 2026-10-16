import { useCallback, useEffect } from 'react';
import { Modal } from 'antd';

/** The same guard serves drawer close, navigation and browser unload. */
export function useUnsavedChanges({ dirty, busy, title = '当前填写尚未保存', content = '离开会丢弃本次输入，确认离开吗？',
  okText = '丢弃输入并离开', cancelText = '继续填写' }: {
  dirty: boolean; busy: boolean; title?: string; content?: string; okText?: string; cancelText?: string;
}) {
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty, busy]);
  return useCallback(() => new Promise<boolean>((resolve) => {
    if (busy) { resolve(false); return; }
    if (!dirty) { resolve(true); return; }
    Modal.confirm({ title, content, okText, cancelText, onOk: () => resolve(true), onCancel: () => resolve(false) });
  }), [busy, dirty, title, content, okText, cancelText]);
}
