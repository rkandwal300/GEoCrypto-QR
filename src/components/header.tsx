"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  QrCode24Regular,
  Scan24Regular,
  Chat24Regular,
} from "@fluentui/react-icons";

export function Header() {
  const pathname = usePathname();

  const navItems = [
    {
      href: "/",
      label: "Generate",
      icon: <QrCode24Regular className="h-4 w-4" />,
    },
    { href: "/scan", label: "Scan", icon: <Scan24Regular className="h-4 w-4" /> },
    { href: "/chat", label: "Chat", icon: <Chat24Regular className="h-4 w-4" /> },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center">
        <Link href="/" className="mr-6 flex items-center space-x-2">
          <QrCode24Regular className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg sm:inline-block">GeoCrypt QR</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`transition-colors hover:text-primary px-4 py-2 rounded-lg text-base font-medium flex items-center gap-2 ${
                pathname === item.href
                  ? "text-primary bg-accent"
                  : "text-muted-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
