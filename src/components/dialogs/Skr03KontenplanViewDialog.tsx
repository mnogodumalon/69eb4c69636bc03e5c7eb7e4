import type { Skr03Kontenplan } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { IconPencil } from '@tabler/icons-react';

interface Skr03KontenplanViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Skr03Kontenplan | null;
  onEdit: (record: Skr03Kontenplan) => void;
}

export function Skr03KontenplanViewDialog({ open, onClose, record, onEdit }: Skr03KontenplanViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>SKR03-Kontenplan anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kontonummer</Label>
            <p className="text-sm">{record.fields.kontonummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kontobezeichnung</Label>
            <p className="text-sm">{record.fields.kontobezeichnung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kontoklasse</Label>
            <p className="text-sm">{record.fields.kontoklasse ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}