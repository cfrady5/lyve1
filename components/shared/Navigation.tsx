"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Sessions", href: "/sessions", icon: "📦" },
  { name: "Lyvefolio", href: "/lyvefolio", icon: "💼" },
  { name: "Sales", href: "/sales", icon: "💰" },
  { name: "Insights", href: "/insights", icon: "📊" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:static md:border-0 safe-area-inset-bottom">
      <div className="flex justify-around md:justify-start md:gap-2 md:px-4 max-w-7xl mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-3 px-4 text-xs md:flex-row md:text-sm md:py-2 md:px-4 md:rounded-lg transition-all",
                isActive
                  ? "text-primary font-semibold md:bg-primary/5"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <span className="text-lg md:text-base md:mr-2">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
