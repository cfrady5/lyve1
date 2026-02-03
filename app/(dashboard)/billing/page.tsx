import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export default async function BillingPage() {
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

          {isSubscribed ? (
            <div className="space-y-2">
              <Button variant="secondary" className="w-full" disabled>
                Active Subscription
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Subscription management coming soon
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Button className="w-full" disabled>
                Subscribe to lyve premium
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Payment processing integration coming soon
              </p>
            </div>
          )}
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
              Payment processing integration coming soon.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
