import { useState, useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit: () => Promise<unknown> | unknown;
  successMessage?: string;
  children: ReactNode;
  destructive?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZES = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" } as const;

export function FormDialog({
  open, onOpenChange, title, description,
  submitLabel, cancelLabel, onSubmit, successMessage,
  children, destructive = false, size = "md",
}: FormDialogProps) {
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const { lang } = useTranslation();

  useEffect(() => { if (!open) setPending(false); }, [open]);

  const run = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setPending(true);
    try {
      await onSubmit();
      if (successMessage) toast({ title: successMessage });
      onOpenChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        variant: "destructive",
        title: lang === "ar" ? "فشل الحفظ" : "Save failed",
        description: message,
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SIZES[size]}>
        <form onSubmit={run} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-3">{children}</div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {cancelLabel ?? (lang === "ar" ? "إلغاء" : "Cancel")}
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending} data-testid="button-form-submit">
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : (submitLabel ?? (lang === "ar" ? "حفظ" : "Save"))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
