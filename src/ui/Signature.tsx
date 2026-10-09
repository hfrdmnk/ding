import signature from "../assets/signature.svg?raw";

export function Signature({ className = "" }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Dominik Hofer"
      className={`[&>svg]:h-full [&>svg]:w-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: signature }}
    />
  );
}
