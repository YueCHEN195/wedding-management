import { motion } from 'framer-motion';
import { wedding } from '@shared/wedding';
import { openMap, share } from './invitationActions';
import type { useCountdown } from './useCountdown';
import type { InvitationModel } from './useInvitation';
import { RsvpForm } from './RsvpForm.view';
import { RED, GOLD, PAPER, sectionStyle, titleStyle, cardStyle } from './invitationStyles';
function pad(n: number) {
  return String(n).padStart(2, '0');
}
export function InviteContent({
  model,
  cd,
}: {
  model: InvitationModel;
  cd: ReturnType<typeof useCountdown>;
}) {
  const { greeting } = model;
  return (
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
          <img
            src={wedding.images.gallery[0]}
            alt="couple"
            style={{ width: '100%', borderRadius: 12, objectFit: 'cover' }}
          />
        </div>
        <p style={{ textAlign: 'center', marginTop: 16, opacity: 0.9, lineHeight: 1.9 }}>
          {wedding.story}
        </p>
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
            {new Date(wedding.date).toLocaleString('zh-CN', {
              dateStyle: 'full',
              timeStyle: 'short',
            })}
          </p>
          <p style={{ margin: '8px 0' }}>
            {wedding.venue.name} · {wedding.venue.hall}
          </p>
          <p style={{ margin: '0 0 16px', color: '#666' }}>{wedding.venue.address}</p>
          <button
            onClick={openMap}
            style={{
              width: '100%',
              background: RED,
              color: PAPER,
              border: 'none',
              padding: '10px 0',
              borderRadius: 8,
              fontSize: 15,
              cursor: 'pointer',
            }}
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
            <img
              key={i}
              src={img}
              alt={`gallery-${i}`}
              style={{ width: '100%', borderRadius: 8, display: 'block' }}
            />
          ))}
        </div>
      </div>

      <RsvpForm model={model} />
      {/* 联系与分享 */}
      <div style={{ ...sectionStyle, textAlign: 'center', paddingBottom: 60 }}>
        <div style={{ color: GOLD, marginBottom: 12 }}>{wedding.closingText}</div>
        <div style={{ letterSpacing: 4, marginBottom: 20 }}>
          {wedding.groomName} &amp; {wedding.brideName} 敬邀
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <a
            href={`tel:${wedding.contact.phone}`}
            style={{
              color: PAPER,
              border: `1px solid ${GOLD}`,
              borderRadius: 999,
              padding: '8px 20px',
              textDecoration: 'none',
            }}
          >
            联系新人
          </a>
          <button
            onClick={share}
            style={{
              background: 'transparent',
              color: PAPER,
              border: `1px solid ${GOLD}`,
              borderRadius: 999,
              padding: '8px 20px',
              cursor: 'pointer',
            }}
          >
            分享请柬
          </button>
        </div>
      </div>
    </motion.div>
  );
}
