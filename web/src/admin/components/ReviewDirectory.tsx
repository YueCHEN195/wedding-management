import { useReviewDirectory, type ReviewDirectoryProps } from '../review/useReviewDirectory';
import { ReviewDirectoryView } from '../review/ReviewDirectory.view';
export function ReviewDirectory(props: ReviewDirectoryProps) {
  const model = useReviewDirectory(props.admin);
  return <ReviewDirectoryView {...props} model={model} />;
}
