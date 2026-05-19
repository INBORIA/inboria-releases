import React from "react";

interface EmailRowSkeletonProps {
  count?: number;
}

export function EmailRowSkeleton({ count = 8 }: EmailRowSkeletonProps) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: count }).map((_, i) => {
        const senderWidth = 60 + ((i * 17) % 60);
        const subjectWidth = 30 + ((i * 23) % 50);
        const extractWidth = 25 + ((i * 31) % 40);
        return (
          <div
            key={i}
            className="relative flex items-center gap-3 h-[52px] pl-2 pr-3 border-l-2 border-l-transparent border-b border-border/40"
          >
            <div className="w-3 h-3 shrink-0" />
            <div className="w-7 h-7 rounded-full bg-white/[0.06] shrink-0" />
            <div className="w-[140px] shrink-0">
              <div
                className="h-[11px] rounded bg-white/[0.08]"
                style={{ width: `${senderWidth}%` }}
              />
            </div>
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <div
                className="h-[11px] rounded bg-white/[0.08]"
                style={{ width: `${subjectWidth}%` }}
              />
              <div
                className="h-[11px] rounded bg-white/[0.04]"
                style={{ width: `${extractWidth}%` }}
              />
            </div>
            <div className="w-12 h-[10px] rounded bg-white/[0.05] shrink-0" />
          </div>
        );
      })}
    </div>
  );
}
