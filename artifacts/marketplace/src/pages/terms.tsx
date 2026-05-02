import { useTranslation } from "@/lib/i18n";

export default function Terms() {
  const { t } = useTranslation();
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <div className="prose prose-slate max-w-none text-muted-foreground">
        <p>Last updated: {new Date().toLocaleDateString()}</p>
        <p>By using Khidma, you agree to these terms...</p>
      </div>
    </div>
  );
}
