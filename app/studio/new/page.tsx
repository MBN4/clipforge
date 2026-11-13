import { BatchComposer } from "@/components/studio/BatchComposer";
import { PageHeader } from "@/components/studio/ui";

export default function NewProjectPage() {
  return (
    <>
      <PageHeader title="New project" subtitle="Add as many videos as you like. They're clipped in parallel and you can watch every one from the Queue." />
      <BatchComposer />
    </>
  );
}
