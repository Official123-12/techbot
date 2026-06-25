interface AppLogoProps {
  className?: string;
}

export function AppLogoIcon({ className = "w-4 h-4" }: AppLogoProps) {
  return (
    <span
      className={`inline-flex items-center justify-center font-black text-white select-none ${className}`}
      style={{ fontFamily: "inherit", lineHeight: 1 }}
    >
      T
    </span>
  );
}
