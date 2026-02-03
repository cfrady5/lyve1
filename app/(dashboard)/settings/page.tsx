import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/settings/ThemeToggle";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences.</p>
      </div>

      {/* Account Section */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
          </div>
          <div>
            <Label>Password</Label>
            <p className="text-sm text-muted-foreground mt-1 mb-2">
              Change your password
            </p>
            <Button variant="outline" size="sm" disabled>
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preferences Section */}
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Customize your experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ThemeToggle />
          <div>
            <Label>Default Platform</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Set your preferred sales platform
            </p>
          </div>
          <div>
            <Label>CSV Export Format</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Choose your export file format
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Data Section */}
      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>Manage your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Export All Data</Label>
            <p className="text-sm text-muted-foreground mt-1 mb-2">
              Download all your data in CSV format
            </p>
            <Button variant="outline" size="sm" disabled>
              Export Data
            </Button>
          </div>
          <div>
            <Label className="text-destructive">Delete Account</Label>
            <p className="text-sm text-muted-foreground mt-1 mb-2">
              Permanently delete your account and all data
            </p>
            <Button variant="destructive" size="sm" disabled>
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
