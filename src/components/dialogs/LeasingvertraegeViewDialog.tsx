import type { Leasingvertraege, Lieferanten, Skr03Kontenplan } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
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

interface LeasingvertraegeViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Leasingvertraege | null;
  onEdit: (record: Leasingvertraege) => void;
  lieferantenList: Lieferanten[];
  skr03_kontenplanList: Skr03Kontenplan[];
}

export function LeasingvertraegeViewDialog({ open, onClose, record, onEdit, lieferantenList, skr03_kontenplanList }: LeasingvertraegeViewDialogProps) {
  function getLieferantenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return lieferantenList.find(r => r.record_id === id)?.fields.name ?? '—';
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
          <DialogTitle>Leasingverträge anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fahrzeugbezeichnung</Label>
            <p className="text-sm">{record.fields.fahrzeugbezeichnung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kennzeichen</Label>
            <p className="text-sm">{record.fields.kennzeichen ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Leasingvertragsnummer</Label>
            <p className="text-sm">{record.fields.leasingvertragsnummer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Leasinggeber</Label>
            <p className="text-sm">{getLieferantenDisplayName(record.fields.leasinggeber)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Leasingbeginn</Label>
            <p className="text-sm">{formatDate(record.fields.leasingbeginn)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Leasingende</Label>
            <p className="text-sm">{formatDate(record.fields.leasingende)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Leasingrate brutto (EUR)</Label>
            <p className="text-sm">{record.fields.leasingrate_brutto ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Listenpreis brutto (EUR)</Label>
            <p className="text-sm">{record.fields.listenpreis_brutto ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Private Nutzungsmethode</Label>
            <Badge variant="secondary">{record.fields.private_nutzungsmethode?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Privatanteil % (nur bei Fahrtenbuch)</Label>
            <p className="text-sm">{record.fields.privatanteil_prozent ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">SKR03-Konto Leasing</Label>
            <p className="text-sm">{getSkr03KontenplanDisplayName(record.fields.skr03_konto_leasing)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">SKR03-Konto USt-Rückführung</Label>
            <p className="text-sm">{getSkr03KontenplanDisplayName(record.fields.skr03_konto_ust_rueckfuehrung)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nettoleasingrate (EUR, berechnet)</Label>
            <p className="text-sm">{record.fields.nettoleasingrate ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">MwSt aus Leasingrate (EUR, berechnet)</Label>
            <p className="text-sm">{record.fields.mwst_aus_leasingrate ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Berechnungsgrundlage 1%-Regel (EUR, berechnet)</Label>
            <p className="text-sm">{record.fields.berechnungsgrundlage_ein_prozent ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">MwSt-Anteil Rückführung (EUR, berechnet)</Label>
            <p className="text-sm">{record.fields.mwst_anteil_rueckfuehrung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">MwSt-Rückführung Buchungsbetrag (EUR, berechnet)</Label>
            <p className="text-sm">{record.fields.mwst_rueckfuehrung_buchungsbetrag ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}