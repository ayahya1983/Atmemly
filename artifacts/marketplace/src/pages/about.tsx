import { useTranslation } from "@/lib/i18n";

export default function About() {
  const { t } = useTranslation();
  
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-4xl font-bold mb-8">About Khidma</h1>
      <div className="prose prose-slate max-w-none text-muted-foreground space-y-6">
        <p>
          Khidma is the premier platform connecting visionary clients with the finest freelance talent across the GCC.
          Built specifically for the regional market, we understand the nuances of business in Dubai and the wider Middle East.
        </p>
        <p>
          Our mission is to empower professionals to work flexibly while providing businesses access to vetted, high-quality expertise.
        </p>
      </div>
    </div>
  );
}
