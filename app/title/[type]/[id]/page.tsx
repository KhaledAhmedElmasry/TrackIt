import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { TitleDetailClient } from "@/components/title/title-detail-client";

interface PageProps {
  params: Promise<{
    type: string;
    id: string;
  }>;
}

function TitleSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <Loader2 className="w-8 h-8 text-[#0a84ff] animate-spin" />
      <p className="text-xs text-[#8e8e93]">Loading title details...</p>
    </div>
  );
}

export default function TitleDetailPage({ params }: PageProps) {
  return (
    <Suspense fallback={<TitleSkeleton />}>
      <TitleDetailClient params={params} />
    </Suspense>
  );
}
