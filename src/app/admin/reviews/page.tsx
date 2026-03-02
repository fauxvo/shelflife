import { ReviewRoundList } from "@/components/admin/ReviewRoundList";

export default function AdminReviewsPage() {
  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Review Rounds</h2>
      <ReviewRoundList />
    </div>
  );
}
