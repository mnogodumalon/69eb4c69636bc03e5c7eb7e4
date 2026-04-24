import type { Belegpositionen, Belege, Skr03Kontenplan } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';

interface BelegpositionenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Belegpositionen | null;
  onEdit: (record: Belegpositionen) => void;
  belegeList: Belege[];
  skr03_kontenplanList: Skr03Kontenplan[];
}

export function BelegpositionenViewDialog({ open, onClose, record, onEdit, belegeList, skr03_kontenplanList }: BelegpositionenViewDialogProps) {
  function getBelegeDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return belegeList.find(r => r.record_id === id)?.fields.belegnummer_lieferant ?? '—';
  }

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
          <DialogTitle>Belegpositionen anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Beleg</Label>
            <p className="text-sm">{getBelegeDisplayName(record.fields.beleg_ref)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Positionsnummer</Label>
            <p className="text-sm">{record.fields.positionsnummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bezeichnung</Label>
            <p className="text-sm">{record.fields.bezeichnung_pos ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Menge</Label>
            <p className="text-sm">{record.fields.menge ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Einheit</Label>
            <p className="text-sm">{record.fields.einheit ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Einzelpreis netto (EUR)</Label>
            <p className="text-sm">{record.fields.einzelpreis_netto ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nettobetrag (EUR, berechnet: Menge × Einzelpreis)</Label>
            <p className="text-sm">{record.fields.nettobetrag_pos ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">MwSt-Satz</Label>
            <Badge variant="secondary">{record.fields.mwst_satz_pos?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">MwSt-Betrag (EUR, berechnet)</Label>
            <p className="text-sm">{record.fields.mwst_betrag_pos ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bruttobetrag (EUR, berechnet)</Label>
            <p className="text-sm">{record.fields.bruttobetrag_pos ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">SKR03-Konto Position</Label>
            <p className="text-sm">{getSkr03KontenplanDisplayName(record.fields.skr03_konto_pos)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bemerkung</Label>
            <p className="text-sm">{record.fields.bemerkung_pos ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}