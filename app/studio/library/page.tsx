import { Suspense } from "react";
import { LibraryView } from "@/components/studio/LibraryView";

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl border border-line bg-ink-2/60" />}>
      <LibraryView />
    </Suspense>
  );
}
