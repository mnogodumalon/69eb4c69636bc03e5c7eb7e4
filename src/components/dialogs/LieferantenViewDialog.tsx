import type { Lieferanten, Skr03Kontenplan } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { IconPencil } from '@tabler/icons-react';

interface LieferantenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Lieferanten | null;
  onEdit: (record: Lieferanten) => void;
  skr03_kontenplanList: Skr03Kontenplan[];
}

export function LieferantenViewDialog({ open, onClose, record, onEdit, skr03_kontenplanList }: LieferantenViewDialogProps) {
  function getSkr03KontenplanDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return skr03_kontenplanList.find(r => r.record_id === id)?.fields.kontonummer ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lieferanten anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <p className="text-sm">{record.fields.name ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Straße</Label>
            <p className="text-sm">{record.fields.strasse ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">PLZ</Label>
            <p className="text-sm">{record.fields.plz ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ort</Label>
            <p className="text-sm">{record.fields.ort ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">USt-IdNr.</Label>
            <p className="text-sm">{record.fields.ust_idnr ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Steuernummer</Label>
            <p className="text-sm">{record.fields.steuernummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Standard-SKR03-Konto</Label>
            <p className="text-sm">{getSkr03KontenplanDisplayName(record.fields.standard_skr03_konto)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bemerkung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.bemerkung_lieferant ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}