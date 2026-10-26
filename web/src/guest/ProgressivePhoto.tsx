import { useEffect, useState, type ImgHTMLAttributes } from 'react';
import { guestPhoto } from './photos';
import './progressive-photo.css';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'sizes'> & {
  src: string;
};

/** One image element keeps the same crop and dimensions while its source upgrades. */
export function ProgressivePhoto({
  src,
  className,
  loading,
  fetchPriority,
  onLoad,
  onError,
  ...props
}: Props) {
  const photo = guestPhoto(src);
  const [decoded, setDecoded] = useState<string>();
  const [visible, setVisible] = useState<string>();
  const [previewFailed, setPreviewFailed] = useState<string>();
  const [fullFailed, setFullFailed] = useState<string>();
  const ready = decoded === photo.src || photo.preview === photo.src;
  const active = loading !== 'lazy' || visible === photo.src;
  const showingPreview = !ready && previewFailed !== photo.src;

  useEffect(() => {
    if (!active || photo.preview === photo.src) return;
    let alive = true;
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = fetchPriority ?? 'auto';
    const fail = () => {
      if (alive) setFullFailed(photo.src);
    };
    const reveal = () => {
      if (alive) setDecoded(photo.src);
    };
    image.onload = () => {
      if (typeof image.decode === 'function') void image.decode().then(reveal, fail);
      else reveal();
    };
    image.onerror = fail;
    image.src = photo.src;
    return () => {
      alive = false;
      image.onload = null;
      image.onerror = null;
    };
  }, [active, photo.src, photo.preview, fetchPriority]);

  return (
    <img
      {...props}
      src={showingPreview ? photo.preview : photo.src}
      width={props.width ?? photo.width}
      height={props.height ?? photo.height}
      className={['guest-photo', className].filter(Boolean).join(' ')}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      data-photo-state={ready ? 'ready' : fullFailed === photo.src ? 'preview-only' : 'preview'}
      onLoad={(event) => {
        setVisible(photo.src);
        onLoad?.(event);
      }}
      onError={(event) => {
        if (showingPreview) {
          setPreviewFailed(photo.src);
          setVisible(photo.src);
        } else onError?.(event);
      }}
    />
  );
}
