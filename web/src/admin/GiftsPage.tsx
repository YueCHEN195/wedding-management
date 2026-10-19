import { useGiftsPage } from './gifts/useGiftsPage';
import { GiftsView } from './gifts/Gifts.view';
export function GiftsPage() {
  const model = useGiftsPage();
  return <GiftsView model={model} />;
}
