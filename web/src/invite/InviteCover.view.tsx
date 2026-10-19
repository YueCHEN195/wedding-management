import { motion } from 'framer-motion';
import { wedding } from '@shared/wedding';
import { RED, GOLD, PAPER } from './invitationStyles';
export function InviteCover({ onOpen }: { onOpen: () => void }) {
  return (
    <>
      {' '}
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
          <div style={{ color: GOLD, letterSpacing: 3 }}>
            {new Date(wedding.date).toLocaleDateString('zh-CN')}
          </div>
          <div style={{ height: 40 }} />
          <button
            onClick={onOpen}
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
    </>
  );
}
