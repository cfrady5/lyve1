import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, CheckCircle2, XCircle } from "lucide-react";
import { SubscribeButton } from "@/components/billing/SubscribeButton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { success?: string; canceled?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, subscription_status')
    .eq('id', user.id)
    .single();

  const isSubscribed = profile?.tier && profile.tier !== 'free';
  const subscriptionStatus = profile?.subscription_status || 'inactive';

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground">Manage your subscription and billing details.</p>
      </div>

      {/* Success/Cancel Messages */}
      {searchParams.success && (
        <Alert className="bg-success-subtle border-success-subtle">
          <CheckCircle2 className="h-4 w-4 text-success-subtle" />
          <AlertDescription className="text-success-subtle">
            Subscription activated successfully! Welcome to lyve premium.
          </AlertDescription>
        </Alert>
      )}
      {searchParams.canceled && (
        <Alert className="bg-warning-subtle border-warning-subtle">
          <XCircle className="h-4 w-4 text-warning-subtle" />
          <AlertDescription className="text-warning-subtle">
            Subscription canceled. You can try again whenever you&apos;re ready.
          </AlertDescription>
        </Alert>
      )}

      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Subscription Status</CardTitle>
              <CardDescription>
                {isSubscribed ? 'Active subscription' : 'No active subscription'}
              </CardDescription>
            </div>
            <Badge variant={isSubscribed ? 'default' : 'secondary'}>
              {isSubscribed ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </CardHeader>
        {isSubscribed && (
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan:</span>
                <span className="font-medium">lyve premium</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-medium capitalize">{subscriptionStatus}</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* lyve premium Plan */}
      <Card className={isSubscribed ? 'border-primary' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">lyve premium</CardTitle>
              <CardDescription className="text-lg">$29/month</CardDescription>
            </div>
          </div>
          <p className="text-muted-foreground pt-2">
            Professional inventory management for live sellers.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="font-medium text-sm">Everything you need to track and optimize your inventory:</p>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Unlimited sessions for streams and collections</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Advanced sorting and filtering across your inventory</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Bulk editing and cost basis management</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>CSV import and automatic item matching</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Comprehensive profit tracking and analytics</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Session performance breakdowns</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Complete lyvefolio view of held and sold items</span>
              </li>
            </ul>
          </div>

          <SubscribeButton isSubscribed={isSubscribed} />
        </CardContent>
      </Card>

      {/* Payment Method (only show for subscribers) */}
      {isSubscribed && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>Manage your billing information</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Click &ldquo;Manage Subscription&rdquo; above to update your payment method and view invoices.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
