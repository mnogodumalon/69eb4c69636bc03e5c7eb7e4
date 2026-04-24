import type { Steuerperioden } from '@/types/app';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface SteuerperiodenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Steuerperioden | null;
  onEdit: (record: Steuerperioden) => void;
}

export function SteuerperiodenViewDialog({ open, onClose, record, onEdit }: SteuerperiodenViewDialogProps) {
  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Steuerperioden anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bezeichnung</Label>
            <p className="text-sm">{record.fields.bezeichnung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Steuerjahr</Label>
            <p className="text-sm">{record.fields.steuerjahr ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Quartal</Label>
            <Badge variant="secondary">{record.fields.quartal?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Von</Label>
            <p className="text-sm">{formatDate(record.fields.von)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bis</Label>
            <p className="text-sm">{formatDate(record.fields.bis)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Badge variant="secondary">{record.fields.status_periode?.label ?? '—'}</Badge>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}