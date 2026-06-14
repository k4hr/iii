import type {ReactNode} from 'react';
import {Header} from '@/components/layout/Header';
import {LabBackground} from '@/components/ui/lab-background';

export function FuturisticShell({children, locale}: {children: ReactNode; locale: string}) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-[#020506]">
      <LabBackground />
      <Header locale={locale} />
      <main className="relative z-10 mx-auto min-h-screen w-full max-w-[1440px] px-5 pb-16 pt-8 sm:px-8 lg:px-10">
        {children}
      </main>
    </div>
  );
}
