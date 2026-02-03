import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SessionReportContent } from "./SessionReportContent";
import { LoadingState } from "@/components/shared/LoadingState";

interface ReportPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify session exists and belongs to user
  const { data: session, error } = await supabase
    .from("sessions")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !session) {
    notFound();
  }

  return (
    <Suspense fallback={<LoadingState message="Loading report..." />}>
      <SessionReportContent sessionId={id} sessionStatus={session.status} />
    </Suspense>
  );
}
