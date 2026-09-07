import type React from "react";

/* eslint-disable jsx-a11y/prefer-tag-over-role */

export const LogoIcon = ({ className, style, ...props }: React.ComponentProps<"span">) => (
  <span
    aria-label="Keiri Icon"
    role="img"
    className={className}
    style={{
      display: "inline-block",
      maskImage: "url(/logo-icon.svg)",
      WebkitMaskImage: "url(/logo-icon.svg)",
      backgroundColor: "currentColor",
      maskSize: "contain",
      WebkitMaskSize: "contain",
      maskRepeat: "no-repeat",
      WebkitMaskRepeat: "no-repeat",
      width: "1em", // default size
      height: "1em",
      ...style,
    }}
    {...props}
  />
);

export const Logo = ({ className, style, ...props }: React.ComponentProps<"span">) => (
  <span
    aria-label="Keiri Logo"
    role="img"
    className={className}
    style={{
      display: "inline-block",
      maskImage: "url(/logo.svg)",
      WebkitMaskImage: "url(/logo.svg)",
      backgroundColor: "currentColor",
      maskSize: "contain",
      WebkitMaskSize: "contain",
      maskRepeat: "no-repeat",
      WebkitMaskRepeat: "no-repeat",
      width: "114px", // typical intrinsic width
      height: "24px",
      ...style,
    }}
    {...props}
  />
);
