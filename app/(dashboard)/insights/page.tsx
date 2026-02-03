import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { InsightsContent } from "./InsightsContent";
import { LoadingState } from "@/components/shared/LoadingState";

export default async function InsightsPage() {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense fallback={<LoadingState message="Loading insights..." />}>
      <InsightsContent />
    </Suspense>
  );
}
