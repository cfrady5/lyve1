"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <Label>Dark Mode</Label>
          <p className="text-sm text-muted-foreground mt-1">
            Toggle between light and dark themes
          </p>
        </div>
        <Switch disabled />
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <div className="flex items-center justify-between">
      <div>
        <Label>Dark Mode</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Toggle between light and dark themes
        </p>
      </div>
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => {
          setTheme(checked ? "dark" : "light");
        }}
      />
    </div>
  );
}
