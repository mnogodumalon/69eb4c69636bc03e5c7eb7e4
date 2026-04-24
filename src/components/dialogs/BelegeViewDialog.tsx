import type { Belege, Lieferanten, Steuerperioden, Skr03Kontenplan } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface BelegeViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Belege | null;
  onEdit: (record: Belege) => void;
  lieferantenList: Lieferanten[];
  steuerperiodenList: Steuerperioden[];
  skr03_kontenplanList: Skr03Kontenplan[];
}

export function BelegeViewDialog({ open, onClose, record, onEdit, lieferantenList, steuerperiodenList, skr03_kontenplanList }: BelegeViewDialogProps) {
  function getLieferantenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return lieferantenList.find(r => r.record_id === id)?.fields.name ?? '—';
  }

  function getSteuerperiodenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return steuerperiodenList.find(r => r.record_id === id)?.fields.bezeichnung ?? '—';
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
          <DialogTitle>Belege anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Beleg-Datei (PDF, JPG, PNG)</Label>
            {record.fields.beleg_datei ? (
              <div className="relative w-full rounded-lg bg-muted overflow-hidden border">
                <img src={record.fields.beleg_datei} alt="" className="w-full h-auto object-contain" />
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Belegnummer Lieferant</Label>
            <p className="text-sm">{record.fields.belegnummer_lieferant ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Lieferant</Label>
            <p className="text-sm">{getLieferantenDisplayName(record.fields.lieferant_ref)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Steuerperiode</Label>
            <p className="text-sm">{getSteuerperiodenDisplayName(record.fields.steuerperiode_ref)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Rechnungsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.rechnungsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fälligkeitsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.faelligkeitsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Buchungsdatum</Label>
            <p className="text-sm">{formatDate(record.fields.buchungsdatum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Upload-Datum (automatisch)</Label>
            <p className="text-sm">{formatDate(record.fields.upload_datum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Belegtyp</Label>
            <Badge variant="secondary">{record.fields.belegtyp?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Dokumentklassifikation</Label>
            <Badge variant="secondary">{record.fields.dokumentklassifikation?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nettobetrag (EUR)</Label>
            <p className="text-sm">{record.fields.nettobetrag ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">MwSt-Satz</Label>
            <Badge variant="secondary">{record.fields.mwst_satz?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">MwSt-Betrag (EUR, berechnet)</Label>
            <p className="text-sm">{record.fields.mwst_betrag ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bruttobetrag (EUR, berechnet)</Label>
            <p className="text-sm">{record.fields.bruttobetrag ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Währung</Label>
            <Badge variant="secondary">{record.fields.waehrung?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zahlungsart</Label>
            <Badge variant="secondary">{record.fields.zahlungsart?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Zahlungsstatus</Label>
            <Badge variant="secondary">{record.fields.zahlungsstatus?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">SKR03-Konto Beleg</Label>
            <p className="text-sm">{getSkr03KontenplanDisplayName(record.fields.skr03_konto_beleg)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bemerkungen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.bemerkungen_beleg ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">OCR-Status</Label>
            <Badge variant="secondary">{record.fields.ocr_status?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Verarbeitungsstatus</Label>
            <Badge variant="secondary">{record.fields.verarbeitungsstatus?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Gesperrt (automatisch bei Status 'Gebucht')</Label>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              record.fields.gesperrt ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {record.fields.gesperrt ? 'Ja' : 'Nein'}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}