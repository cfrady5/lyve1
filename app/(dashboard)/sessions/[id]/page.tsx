import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SessionDetailContent } from "./SessionDetailContentNew";
import { LoadingState } from "@/components/shared/LoadingState";

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Verify session exists and belongs to user
  const { data: session, error } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !session) {
    notFound();
  }

  return (
    <Suspense fallback={<LoadingState message="Loading session..." />}>
      <SessionDetailContent sessionId={id} userId={user.id} />
    </Suspense>
  );
}
