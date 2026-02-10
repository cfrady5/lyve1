"use client";

import { User } from "@supabase/supabase-js";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/constants/brand";

interface HeaderProps {
  user: User;
}

const navItems = [
  { name: "Sessions", href: "/sessions", icon: "📦" },
  { name: BRAND.PORTFOLIO, href: "/lyvefolio", icon: "💼" },
  { name: "Insights", href: "/insights", icon: "📊" },
  { name: "lyve calculator", href: "/calculator", icon: "🧮" },
];

export function Header({ user }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 max-w-7xl mx-auto gap-4">
        {/* Logo */}
        <Link
          href="/home"
          className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
          aria-label="go to home"
        >
          <h1 className="text-xl md:text-2xl font-bold tracking-tight lowercase">{BRAND.NAME}</h1>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 md:gap-2 flex-1 justify-center">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all relative",
                  isActive
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <span className="text-base">{item.icon}</span>
                <span className="hidden sm:inline">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Account Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="font-medium shrink-0">
              <span className="hidden md:inline">{user.email}</span>
              <span className="md:hidden">Account</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">Account</p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/account">Account Overview</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/billing">Billing & Plan</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/help">Help</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
