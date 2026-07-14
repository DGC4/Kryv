import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { AnimatedBackground } from './AnimatedBackground';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-[100dvh] flex flex-col relative text-foreground">
      <AnimatedBackground />
      <Header />
      <main className="flex-1 relative z-10 flex flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}
