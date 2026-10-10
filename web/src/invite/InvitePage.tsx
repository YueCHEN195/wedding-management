import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { wedding } from '@shared/wedding';
import type { Attending } from '@shared/types';
import { api, ApiError } from '@/api/client';

const RED = '#8c1c1c';
const RED_DARK = '#5e1010';
const GOLD = '#c8a45c';
const PAPER = '#f7f3ea';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function useCountdown(target: string) {
  const targetMs = useMemo(() => new Date(target).getTime(), [target]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, targetMs - now);
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    minutes: Math.floor((diff / 60000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    arrived: diff <= 0,
  };
}

function openMap() {
  const { name, address, lat, lng } = wedding.venue;
  const q = encodeURIComponent(`${name} ${address}`.trim());
  const ua = navigator.userAgent;
  const hasCoord = lat !== 0 || lng !== 0;
  if (/Android/i.test(ua)) {
    window.location.href = hasCoord ? `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(name)})` : `geo:0,0?q=${q}`;
  } else {
    window.location.href = hasCoord ? `https://maps.apple.com/?ll=${lat},${lng}&q=${q}` : `https://maps.apple.com/?q=${q}`;
  }
}

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const universal = !token;

  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(!!token);
  const [invalid, setInvalid] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [salutation, setSalutation] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [nameInput, setNameInput] = useState('');
  const [attending, setAttending] = useState<Attending>('yes');
  const [headcount, setHeadcount] = useState(1);
  const [children, setChildren] = useState(0);
  const [message, setMessage] = useState('');

  const cd = useCountdown(wedding.date);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    api.invite
      .get(token)
      .then((d) => {
        if (!alive) return;
        setGuestName(d.guestName);
        setSalutation(d.salutation);
        if (d.rsvp) {
          setAttending(d.rsvp.attending);
          setHeadcount(d.rsvp.headcount || 1);
          setChildren(d.rsvp.childrenCount || 0);
          setMessage(d.rsvp.message ?? '');
          setSubmitted(true);
        }
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setInvalid(true);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [token]);

  const greeting = salutation ?? guestName ?? null;

  async function submit() {
    if (universal && !nameInput.trim()) {
      alert('请填写您的姓名');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        attending,
        headcount: attending === 'yes' ? headcount : 0,
        childrenCount: attending === 'yes' ? children : 0,
        message,
      };
      if (token) await api.invite.rsvp(token, payload);
      else await api.invite.universalRsvp({ ...payload, name: nameInput.trim() });
      setSubmitted(true);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : '提交失败，请稍后再试');
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: '婚礼邀请', url });
      else {
        await navigator.clipboard.writeText(url);
        alert('链接已复制');
      }
    } catch {
      /* 取消分享 */
    }
  }

  const sectionStyle: CSSProperties = {
    padding: '40px 24px',
    maxWidth: 520,
    margin: '0 auto',
  };
  const titleStyle: CSSProperties = {
    textAlign: 'center',
    color: GOLD,
    letterSpacing: 4,
    fontSize: 14,
    marginBottom: 20,
  };
  const cardStyle: CSSProperties = {
    background: PAPER,
    color: '#2b2b2b',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 6px 24px rgba(0,0,0,0.18)',
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: RED, color: PAPER }}>
        加载中…
      </div>
    );
  }

  if (invalid) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: RED_DARK, color: PAPER, textAlign: 'center', padding: 24 }}>
        <div>
          <div style={{ fontSize: 48 }}>囍</div>
          <h2>请柬链接有误</h2>
          <p style={{ opacity: 0.8 }}>请联系新人获取正确的邀请链接</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: `linear-gradient(180deg, ${RED} 0%, ${RED_DARK} 100%)`, minHeight: '100vh', color: PAPER }}>
      {/* 封面 */}
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 24,
          position: 'relative',
          backgroundImage: `url(${wedding.images.cover})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: RED,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(94,16,16,0.55)' }} />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <div style={{ fontSize: 96, color: GOLD, lineHeight: 1 }}>囍</div>
          <h1 style={{ color: PAPER, fontSize: 30, margin: '18px 0 6px', letterSpacing: 6 }}>
            {wedding.groomName} &amp; {wedding.brideName}
          </h1>
          <div style={{ color: GOLD, letterSpacing: 3 }}>{new Date(wedding.date).toLocaleDateString('zh-CN')}</div>
          <div style={{ height: 40 }} />
          <button
            onClick={() => setOpened(true)}
            style={{
              background: 'transparent',
              border: `1px solid ${GOLD}`,
              color: GOLD,
              padding: '10px 28px',
              borderRadius: 999,
              fontSize: 16,
              letterSpacing: 4,
              cursor: 'pointer',
            }}
          >
            打开请柬
          </button>
        </motion.div>
      </div>

      {opened && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}>
          {/* 问候 */}
          <div style={sectionStyle}>
            <p style={{ textAlign: 'center', lineHeight: 2, fontSize: 16 }}>
              {greeting ? `亲爱的 ${greeting}：` : '亲爱的亲友：'}
              <br />
              {wedding.invitationText}
            </p>
          </div>

          {/* 新人 */}
          <div style={sectionStyle}>
            <div style={titleStyle}>— 我们 —</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <img src={wedding.images.gallery[0]} alt="couple" style={{ width: '100%', borderRadius: 12, objectFit: 'cover' }} />
            </div>
            <p style={{ textAlign: 'center', marginTop: 16, opacity: 0.9, lineHeight: 1.9 }}>{wedding.story}</p>
          </div>

          {/* 倒计时 */}
          <div style={sectionStyle}>
            <div style={titleStyle}>— 婚礼倒计时 —</div>
            {cd.arrived ? (
              <div style={{ textAlign: 'center', fontSize: 22, color: GOLD }}>今天，我们结婚啦</div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                {[
                  { v: cd.days, l: '天' },
                  { v: cd.hours, l: '时' },
                  { v: cd.minutes, l: '分' },
                  { v: cd.seconds, l: '秒' },
                ].map((x) => (
                  <div key={x.l} style={{ textAlign: 'center', minWidth: 56 }}>
                    <div style={{ fontSize: 30, color: GOLD }}>{pad(x.v)}</div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{x.l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 婚礼信息 */}
          <div style={sectionStyle}>
            <div style={titleStyle}>— 婚礼信息 —</div>
            <div style={cardStyle}>
              <p style={{ margin: 0, fontWeight: 600 }}>
                {new Date(wedding.date).toLocaleString('zh-CN', { dateStyle: 'full', timeStyle: 'short' })}
              </p>
              <p style={{ margin: '8px 0' }}>
                {wedding.venue.name} · {wedding.venue.hall}
              </p>
              <p style={{ margin: '0 0 16px', color: '#666' }}>{wedding.venue.address}</p>
              <button
                onClick={openMap}
                style={{ width: '100%', background: RED, color: PAPER, border: 'none', padding: '10px 0', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}
              >
                一键导航
              </button>
            </div>
          </div>

          {/* 婚礼流程 */}
          <div style={sectionStyle}>
            <div style={titleStyle}>— 婚礼流程 —</div>
            <div style={{ paddingLeft: 8 }}>
              {wedding.schedule.map((s) => (
                <div key={s.time} style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                  <div style={{ color: GOLD, width: 64, textAlign: 'right' }}>{s.time}</div>
                  <div style={{ borderLeft: `1px solid ${GOLD}`, paddingLeft: 16 }}>{s.title}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 相册 */}
          <div style={sectionStyle}>
            <div style={titleStyle}>— 相册 —</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {wedding.images.gallery.map((img, i) => (
                <img key={i} src={img} alt={`gallery-${i}`} style={{ width: '100%', borderRadius: 8, display: 'block' }} />
              ))}
            </div>
          </div>

          {/* 回执 */}
          <div style={sectionStyle}>
            <div style={titleStyle}>— 出席回执 —</div>
            <div style={cardStyle}>
              {universal && !guestName && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6 }}>您的姓名</label>
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="请输入姓名"
                    style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 16 }}
                  />
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span>出席人数（含本人）</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button onClick={() => setHeadcount((n) => Math.max(1, n - 1))} style={stepBtn}>-</button>
                      <span style={{ minWidth: 24, textAlign: 'center', fontSize: 18 }}>{headcount}</span>
                      <button onClick={() => setHeadcount((n) => n + 1)} style={stepBtn}>+</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span>随行儿童</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button onClick={() => setChildren((n) => Math.max(0, n - 1))} style={stepBtn}>-</button>
                      <span style={{ minWidth: 24, textAlign: 'center', fontSize: 18 }}>{children}</span>
                      <button onClick={() => setChildren((n) => n + 1)} style={stepBtn}>+</button>
                    </div>
                  </div>
                </>
              )}

              <label style={{ display: 'block', margin: '8px 0' }}>祝福留言</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="写下您的祝福…"
                style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', fontSize: 15, resize: 'vertical' }}
              />

              <button
                onClick={submit}
                disabled={saving}
                style={{ marginTop: 16, width: '100%', background: RED, color: PAPER, border: 'none', padding: '12px 0', borderRadius: 8, fontSize: 16, letterSpacing: 2, cursor: 'pointer' }}
              >
                {saving ? '提交中…' : submitted ? '更新回执' : '提交回执'}
              </button>
              {submitted && (
                <p style={{ textAlign: 'center', color: '#2e7d32', marginTop: 10 }}>已收到，可再次修改</p>
              )}
            </div>
          </div>

          {/* 联系与分享 */}
          <div style={{ ...sectionStyle, textAlign: 'center', paddingBottom: 60 }}>
            <div style={{ color: GOLD, marginBottom: 12 }}>{wedding.closingText}</div>
            <div style={{ letterSpacing: 4, marginBottom: 20 }}>
              {wedding.groomName} &amp; {wedding.brideName} 敬邀
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <a
                href={`tel:${wedding.contact.phone}`}
                style={{ color: PAPER, border: `1px solid ${GOLD}`, borderRadius: 999, padding: '8px 20px', textDecoration: 'none' }}
              >
                联系新人
              </a>
              <button
                onClick={share}
                style={{ background: 'transparent', color: PAPER, border: `1px solid ${GOLD}`, borderRadius: 999, padding: '8px 20px', cursor: 'pointer' }}
              >
                分享请柬
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

const stepBtn: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: '1px solid #ddd',
  background: '#fff',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
};
