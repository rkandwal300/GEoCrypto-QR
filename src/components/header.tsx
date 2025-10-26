"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Generate" },
    { href: "/scan", label: "Scan" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <QrCode className="h-6 w-6 text-primary" />
          <span className="font-bold sm:inline-block">GeoCrypt QR</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "transition-colors hover:text-foreground/80 px-3 py-2 rounded-md",
                pathname === item.href
                  ? "text-foreground font-semibold bg-accent/30"
                  : "text-foreground/60"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
