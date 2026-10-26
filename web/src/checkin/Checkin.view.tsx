import { useEffect, useRef, useState, type RefObject } from 'react';
import { wedding } from '@shared/wedding';
import { ProgressivePhoto } from '../guest/ProgressivePhoto';
import type { PublicCheckinModel } from './usePublicCheckin';
import '../guest/guest-tokens.css';
import './checkin.css';

type ResultState = Exclude<PublicCheckinModel['state'], 'idle' | 'saving'>;
const resultCopy = {
  done: {
    mark: '···',
    title: '登记已提交',
    description: '请到签到处等候工作人员核对。',
    helper: '工作人员确认后，才算完成签到。',
    action: '为另一位宾客登记',
  },
  dup: {
    mark: '···',
    title: '你已提交过登记',
    description: '无需重复提交，请在签到处等候核对。',
    helper: '如姓名填写有误，请联系现场工作人员。',
    action: '为另一位宾客登记',
  },
  confirmed: {
    mark: '✓',
    title: '已完成签到',
    description: '工作人员已确认，感谢你的到来。',
    helper: '愿你在这场相聚里，留下美好的回忆。',
    action: '为另一位宾客登记',
  },
  inactive: {
    mark: '!',
    title: '这条登记已失效',
    description: '登记已被驳回或撤销，请联系现场工作人员核对。',
    helper: '如需重新登记，可使用下方按钮。',
    action: '重新填写姓名',
  },
} satisfies Record<
  ResultState,
  { mark: string; title: string; description: string; helper: string; action: string }
>;

export function CheckinView({ model }: { model: PublicCheckinModel }) {
  const [imageFailed, setImageFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const hasShownResult = useRef(false);
  const { state } = model;
  const resultState = state === 'idle' || state === 'saving' ? null : state;

  // Reading focus follows real responses; opening the page does not summon the mobile keyboard.
  useEffect(() => {
    if (resultState) {
      resultRef.current?.focus();
      hasShownResult.current = true;
    } else if (hasShownResult.current) {
      inputRef.current?.focus();
      hasShownResult.current = false;
    }
  }, [resultState]);

  return (
    <main className="guest-experience guest-checkin">
      <div className="checkin-sheet" data-result={Boolean(resultState)}>
        <header className="checkin-header">
          <p className="guest-brand checkin-brand">
            <span className="guest-brand-mark" aria-hidden="true" />
            {wedding.groomName} 与 {wedding.brideName}的婚礼
          </p>
          <div className="checkin-visual" aria-hidden="true">
            {!imageFailed ? (
              <ProgressivePhoto
                src={wedding.images.checkin}
                alt=""
                decoding="async"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <>
                <span className="checkin-visual-word">相聚</span>
                <span className="checkin-visual-caption">诚邀 · 相见</span>
              </>
            )}
          </div>
          {!resultState && (
            <div className="checkin-welcome">
              <h1>有你，正好。</h1>
              <p>欢迎来到我们的婚礼。</p>
            </div>
          )}
        </header>
        {resultState ? (
          <CheckinResult state={resultState} model={model} resultRef={resultRef} />
        ) : (
          <CheckinForm model={model} inputRef={inputRef} />
        )}
        <footer className="checkin-help">扫码或登记不便，请向现场工作人员寻求帮助。</footer>
      </div>
    </main>
  );
}

function CheckinForm({
  model: { name, setName, state, error, submit },
  inputRef,
}: {
  model: Pick<PublicCheckinModel, 'name' | 'setName' | 'state' | 'error' | 'submit'>;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const saving = state === 'saving';
  return (
    <form
      autoComplete="off"
      className="checkin-form"
      noValidate
      aria-busy={saving}
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) inputRef.current?.focus();
        void submit();
      }}
    >
      <label htmlFor="checkin-name">您的姓名</label>
      <input
        ref={inputRef}
        id="checkin-name"
        name="name"
        autoComplete="off"
        enterKeyHint="done"
        required
        maxLength={30}
        placeholder="请输入本人姓名"
        disabled={saving}
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault();
        }}
        aria-invalid={(Boolean(error) && !name.trim()) || undefined}
        aria-describedby={error ? 'checkin-error checkin-name-helper' : 'checkin-name-helper'}
      />
      {error && (
        <p className="checkin-error" id="checkin-error" role="alert">
          {error}
        </p>
      )}
      <p className="checkin-field-helper" id="checkin-name-helper">
        请填写本人姓名，提交后由工作人员核对。
      </p>
      <button className="checkin-primary" type="submit" disabled={saving}>
        {saving && <span className="checkin-spinner" aria-hidden="true" />}
        {saving ? '正在提交…' : error ? '重新提交' : '登记到场'}
        {!saving && (
          <span className="checkin-action-arrow" aria-hidden="true">
            ↗
          </span>
        )}
      </button>
      <p className="checkin-saving" role="status">
        {saving ? '正在发送登记，请稍候。' : ''}
      </p>
    </form>
  );
}

function CheckinResult({
  state,
  model: { attempt, next },
  resultRef,
}: {
  state: ResultState;
  model: Pick<PublicCheckinModel, 'attempt' | 'next'>;
  resultRef: RefObject<HTMLElement | null>;
}) {
  const copy = resultCopy[state];
  return (
    <section
      className="checkin-result"
      ref={resultRef}
      tabIndex={-1}
      aria-labelledby="checkin-result-title"
      aria-describedby="checkin-result-description"
    >
      <span className="checkin-state-mark" aria-hidden="true">
        {copy.mark}
      </span>
      <h1 id="checkin-result-title">{copy.title}</h1>
      <p className="checkin-guest-name">{attempt?.name ?? '姓名未记录'}</p>
      <p id="checkin-result-description">{copy.description}</p>
      <p className="checkin-result-helper">{copy.helper}</p>
      <button className="checkin-primary" type="button" onClick={next}>
        {copy.action}
      </button>
    </section>
  );
}
