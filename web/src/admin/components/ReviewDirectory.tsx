import { useReviewDirectory, type ReviewDirectoryProps } from '../review/useReviewDirectory';
import { ReviewDirectoryView } from '../review/ReviewDirectory.view';
import { GiftEditor } from '../gifts/GiftEditor.view';
export function ReviewDirectory(props: ReviewDirectoryProps) {
  const model = useReviewDirectory(props.admin);
  return (
    <>
      <ReviewDirectoryView {...props} model={model} />
      {props.admin && <GiftEditor model={model.giftEditor} />}
    </>
  );
}
