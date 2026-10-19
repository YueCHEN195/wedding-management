import { MAX_HEADCOUNT, MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from '@shared/constraints';
import type { Attending } from '@shared/types';
import type { InvitationModel } from './useInvitation';
import { RED, PAPER, sectionStyle, titleStyle, cardStyle, stepBtn } from './invitationStyles';
export function RsvpForm({ model }: { model: InvitationModel }) {
  const {
    universal,
    guestName,
    nameInput,
    setNameInput,
    attending,
    setAttending,
    headcount,
    setHeadcount,
    children,
    setChildren,
    message,
    setMessage,
    submit,
    saving,
    submitted,
  } = model;
  return (
    <>
      {/* 回执 */}
      <div style={sectionStyle}>
        <div style={titleStyle}>— 出席回执 —</div>
        <div style={cardStyle}>
          {universal && !guestName && (
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="rsvp-name" style={{ display: 'block', marginBottom: 6 }}>
                您的姓名
              </label>
              <input
                id="rsvp-name"
                maxLength={MAX_NAME_LENGTH}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="请输入姓名"
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  fontSize: 16,
                }}
              />
              <p style={{ marginBottom: 0, color: '#666', fontSize: 14 }}>
                本浏览器会记住您的回执，方便下次修改；换设备请联系新人协助。
              </p>
            </div>
          )}

          <label style={{ display: 'block', marginBottom: 8 }}>是否出席</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['yes', 'no', 'maybe'] as Attending[]).map((v) => {
              const label = v === 'yes' ? '出席' : v === 'no' ? '不出席' : '待定';
              const active = attending === v;
              return (
                <button
                  key={v}
                  onClick={() => setAttending(v)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: `1px solid ${active ? RED : '#ddd'}`,
                    background: active ? RED : '#fff',
                    color: active ? PAPER : '#333',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {attending === 'yes' && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <span>出席人数（含本人）</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => {
                      setHeadcount((n) => Math.max(1, n - 1));
                      setChildren((n) => Math.min(n, Math.max(1, headcount - 1)));
                    }}
                    style={stepBtn}
                    aria-label="减少出席人数"
                  >
                    -
                  </button>
                  <span style={{ minWidth: 24, textAlign: 'center', fontSize: 18 }}>
                    {headcount}
                  </span>
                  <button
                    onClick={() => setHeadcount((n) => Math.min(MAX_HEADCOUNT, n + 1))}
                    style={stepBtn}
                    aria-label="增加出席人数"
                  >
                    +
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <span>随行儿童</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => setChildren((n) => Math.max(0, n - 1))}
                    style={stepBtn}
                    aria-label="减少儿童人数"
                  >
                    -
                  </button>
                  <span style={{ minWidth: 24, textAlign: 'center', fontSize: 18 }}>
                    {children}
                  </span>
                  <button
                    onClick={() => setChildren((n) => Math.min(headcount, n + 1))}
                    style={stepBtn}
                    aria-label="增加儿童人数"
                  >
                    +
                  </button>
                </div>
              </div>
            </>
          )}

          <label style={{ display: 'block', margin: '8px 0' }}>祝福留言</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={MAX_TEXT_LENGTH}
            placeholder="写下您的祝福…"
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 8,
              border: '1px solid #ddd',
              fontSize: 15,
              resize: 'vertical',
            }}
          />

          <button
            onClick={submit}
            disabled={saving}
            style={{
              marginTop: 16,
              width: '100%',
              background: RED,
              color: PAPER,
              border: 'none',
              padding: '12px 0',
              borderRadius: 8,
              fontSize: 16,
              letterSpacing: 2,
              cursor: 'pointer',
            }}
          >
            {saving ? '提交中…' : submitted ? '更新回执' : '提交回执'}
          </button>
          {submitted && (
            <p style={{ textAlign: 'center', color: '#2e7d32', marginTop: 10 }}>
              已收到，可再次修改
            </p>
          )}
        </div>
      </div>
    </>
  );
}
