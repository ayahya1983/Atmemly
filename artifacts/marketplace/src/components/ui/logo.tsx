import { Link } from "wouter";
import { BRAND } from "@workspace/branding";

export function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex items-center no-underline hover:opacity-90 transition-opacity leading-none align-middle"
      data-testid="link-logo"
    >
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt={BRAND.name}
        className="block h-10 w-auto object-contain shrink-0"
      />
    </Link>
  );
}
