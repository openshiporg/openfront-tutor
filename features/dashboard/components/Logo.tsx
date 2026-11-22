import { cn } from "@/lib/utils";
import { Syne } from "next/font/google";

const syne = Syne({
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
});

export const LOGO_COLOR = "#1d4ed8";

interface LogoIconProps {
  className?: string;
  color?: string;
  suffix?: string;
}

/** An open book with a pencil stroke across it: Openfront Tutor's mark. */
export const LogoIcon = ({ className, color = LOGO_COLOR }: LogoIconProps) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn("size-5", className)} style={{ color }} aria-hidden="true">
    <path d="M24 13C19 9.5 11.5 8.5 5 9.5V38c6.5-1 14 0 19 3.5V13Z" fill="currentColor" opacity="0.9" />
    <path d="M24 13c5-3.5 12.5-4.5 19-3.5V38c-6.5-1-14 0-19 3.5V13Z" fill="currentColor" opacity="0.55" />
    <path d="M30 30.5 40.5 20l3 3L33 33.5l-4 1 1-4Z" fill="currentColor" />
  </svg>
);

interface LogoProps {
  className?: string;
  textClassName?: string;
  iconClassName?: string;
  variant?: "default" | "sidebar";
}

export const Logo = ({ className, textClassName, iconClassName, variant = "default" }: LogoProps) => {
  const isSidebar = variant === "sidebar";
  return (
    <div className={cn(className, "flex items-center text-left", isSidebar ? "gap-1.5" : "gap-3")}>
      <LogoIcon className={cn("shrink-0", isSidebar ? "size-5" : "size-8", iconClassName)} />
      <div className={cn("flex flex-col justify-center", isSidebar ? "-mt-0.5" : "-mt-1")}>
        <span className={cn(syne.className, textClassName, "font-semibold tracking-tight text-foreground", isSidebar ? "text-[15px] leading-none" : "text-xl")}>
          open<span className="font-normal">front</span>
        </span>
        <span className={cn(syne.className, "font-bold uppercase text-muted-foreground", isSidebar ? "mt-0.5 text-[8px] leading-none tracking-[0.14em]" : "text-[10px] tracking-wider")}>
          Tutor
        </span>
      </div>
    </div>
  );
};
