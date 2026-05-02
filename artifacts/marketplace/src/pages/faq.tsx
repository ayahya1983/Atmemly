import { useMemo, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useFaqs } from "@/lib/api-public";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function Faq() {
  const { lang } = useTranslation();
  const { data: faqs, isLoading } = useFaqs(lang);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const categories = useMemo(() => {
    if (!faqs) return [];
    return Array.from(new Set(faqs.map((f) => f.category)));
  }, [faqs]);

  const filtered = useMemo(() => {
    if (!faqs) return [];
    const active = faqs.filter((f) => f.isActive);
    if (activeCategory === "all") return active;
    return active.filter((f) => f.category === activeCategory);
  }, [faqs, activeCategory]);

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-3">
          {lang === "ar" ? "الأسئلة الشائعة" : "Frequently Asked Questions"}
        </h1>
        <p className="text-muted-foreground">
          {lang === "ar"
            ? "كل ما تحتاج معرفته عن خِدمة."
            : "Everything you need to know about Khidma."}
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !faqs || faqs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            {lang === "ar" ? "لا توجد أسئلة شائعة بعد." : "No FAQs available yet."}
          </CardContent>
        </Card>
      ) : (
        <>
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6">
              <Button
                variant={activeCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveCategory("all")}
              >
                {lang === "ar" ? "الكل" : "All"}
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={activeCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(cat)}
                  className="capitalize"
                >
                  {cat}
                </Button>
              ))}
            </div>
          )}

          <Accordion type="single" collapsible className="space-y-2">
            {filtered.map((faq) => (
              <AccordionItem
                key={faq.id}
                value={`faq-${faq.id}`}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="text-start hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground whitespace-pre-line">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </>
      )}
    </div>
  );
}
