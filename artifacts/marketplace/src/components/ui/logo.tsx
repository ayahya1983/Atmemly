import { Link } from "wouter";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center no-underline hover:opacity-90 transition-opacity"
      data-testid="link-logo"
    >
      <img
        src={`${import.meta.env.BASE_URL}logo.png`}
        alt="Atmemly"
        className="h-9 w-auto object-contain"
      />
    </Link>
  );
}
