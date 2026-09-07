import { Toaster } from "@keiri/ui/components/goey-toaster";
import { TooltipProvider } from "@keiri/ui/components/tooltip";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import { useTheme } from "next-themes";

import { ThemeProvider } from "./ThemeProvider";

function AppToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster theme={resolvedTheme === "dark" ? "dark" : "light"} position="bottom-right" closeButton />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <HotkeysProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <LazyMotion features={domAnimation}>
          <MotionConfig reducedMotion="user">
            <TooltipProvider delay={300}>{children}</TooltipProvider>
            <AppToaster />
          </MotionConfig>
        </LazyMotion>
      </ThemeProvider>
    </HotkeysProvider>
  );
}
