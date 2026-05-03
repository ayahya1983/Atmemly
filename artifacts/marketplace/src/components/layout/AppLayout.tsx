import { ReactNode } from "react";
import { TopNav } from "./TopNav";
import { Footer } from "./Footer";
import { SeoHead } from "@/components/SeoHead";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col w-full bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <SeoHead />
      <TopNav />
      <main className="flex-1 w-full flex flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}
