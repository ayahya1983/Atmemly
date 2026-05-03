import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/lib/i18n";

interface ConfirmActionDialogProps {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown> | unknown;
  successMessage?: string;
  body?: ReactNode;
}

export function ConfirmActionDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  successMessage,
  body,
}: ConfirmActionDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const { toast } = useToast();
  const { lang } = useTranslation();

  const run = async () => {
    setPending(true);
    try {
      await onConfirm();
      if (successMessage) toast({ title: successMessage });
      setOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({
        variant: "destructive",
        title: lang === "ar" ? "فشل التنفيذ" : "Action failed",
        description: message,
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {body}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {cancelLabel ?? (lang === "ar" ? "إلغاء" : "Cancel")}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={run}
            disabled={pending}
            data-testid="button-confirm"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : (confirmLabel ?? (lang === "ar" ? "تأكيد" : "Confirm"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
