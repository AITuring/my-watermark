"use client";
import React from "react";
import { cn } from "@/lib/utils";

function BackgroundGradientAnimation({
  children,
  className,
  containerClassName,
  animate = true,
}: {
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  animate?: boolean;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className={cn(
        "bg-background h-screen w-screen relative flex items-center justify-center",
        containerClassName
      )}
    >
      <div
        className={cn(
          "absolute inset-0 overflow-hidden",
          className
        )}
      >
        {animate && (
          <>
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 opacity-30 absolute inset-0 w-full h-full z-10 transform-gpu animate-gradient-x" />
            <div className="bg-gradient-to-r from-indigo-500 to-teal-500 opacity-30 absolute inset-0 w-full h-full z-10 transform-gpu animate-gradient-y" />
            <div className="bg-gradient-to-r from-pink-500 to-yellow-500 opacity-30 absolute inset-0 w-full h-full z-10 transform-gpu animate-gradient-xy" />
          </>
        )}
        <div className="absolute inset-0 z-20">{children}</div>
      </div>
    </div>
  );
}

export default BackgroundGradientAnimation;