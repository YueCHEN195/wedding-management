import { wedding } from '@shared/wedding';
import type { PublicCheckinModel } from './usePublicCheckin';
const RED = '#8c1c1c';
const GOLD = '#c8a45c';
export function CheckinView({
  model: { attempt, name, setName, state, error, submit, next },
}: {
  model: PublicCheckinModel;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${RED} 0%, #5e1010 100%)`,
        color: '#f7f3ea',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 72, color: GOLD, lineHeight: 1 }}>囍</div>
      <h1 style={{ margin: '16px 0 4px', letterSpacing: 4 }}>
        {wedding.groomName} &amp; {wedding.brideName}
      </h1>
      <p style={{ color: GOLD, marginBottom: 32 }}>现场签到</p>

      {state === 'done' || state === 'dup' || state === 'confirmed' || state === 'inactive' ? (
        <div
          style={{
            background: '#f7f3ea',
            color: '#2b2b2b',
            borderRadius: 16,
            padding: '32px 28px',
            width: '100%',
            maxWidth: 360,
          }}
        >
          <div style={{ fontSize: 48, color: '#2e7d32' }}>{state === 'done' ? '✓' : '☑'}</div>
          <p style={{ margin: '12px 0 0' }}>{attempt?.name}</p>
          <h2 style={{ margin: '12px 0' }}>
            {state === 'inactive'
              ? '此登记已驳回或撤销'
              : state === 'confirmed'
                ? '已完成签到'
                : state === 'dup'
                  ? '您已提交过'
                  : '已提交'}
          </h2>
          <p style={{ color: '#666', margin: 0 }}>
            {state === 'inactive'
              ? '请联系现场工作人员核对；如需重新登记，请使用下方按钮。'
              : state === 'confirmed'
                ? '工作人员已确认您的签到，无需再次提交。感谢您的到来！'
                : '请等待工作人员确认，感谢您的到来！'}
          </p>
          <button
            onClick={next}
            style={{
              marginTop: 20,
              background: RED,
              color: '#fff',
              border: 'none',
              padding: '10px 24px',
              borderRadius: 8,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            为另一位宾客登记
          </button>
        </div>
      ) : (
        <div
          style={{
            background: '#f7f3ea',
            color: '#2b2b2b',
            borderRadius: 16,
            padding: '28px 24px',
            width: '100%',
            maxWidth: 360,
          }}
        >
          <p style={{ marginTop: 0, color: '#666' }}>请输入您的姓名</p>
          <input
            aria-label="姓名"
            disabled={state === 'saving'}
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="姓名"
            autoFocus
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: 20,
              borderRadius: 10,
              border: '1px solid #ddd',
              textAlign: 'center',
              boxSizing: 'border-box',
            }}
          />
          {error && <p style={{ color: '#cf1322' }}>{error}</p>}
          <button
            onClick={submit}
            disabled={state === 'saving'}
            style={{
              marginTop: 18,
              width: '100%',
              background: RED,
              color: '#fff',
              border: 'none',
              padding: '16px 0',
              borderRadius: 10,
              fontSize: 20,
              letterSpacing: 4,
              cursor: 'pointer',
            }}
          >
            {state === 'saving' ? '提交中…' : '签 到'}
          </button>
        </div>
      )}
    </div>
  );
}
