import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AccountContent } from "./AccountContent";
import { LoadingState } from "@/components/shared/LoadingState";

export const metadata = {
  title: "Account | lyve",
  description: "Your account overview and stats",
};

export default async function AccountPage() {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense fallback={<LoadingState message="Loading account..." />}>
      <AccountContent userId={user.id} userEmail={user.email || ""} />
    </Suspense>
  );
}
