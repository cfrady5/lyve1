import { Suspense } from "react";
import { SessionsIndexContent } from "./SessionsIndexContent";
import { LoadingState } from "@/components/shared/LoadingState";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SessionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense fallback={<LoadingState message="Loading sessions..." />}>
      <SessionsIndexContent userId={user.id} />
    </Suspense>
  );
}
