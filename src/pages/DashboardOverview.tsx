import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichBelege } from '@/lib/enrich';
import type { EnrichedBelege } from '@/types/enriched';
import type { Steuerperioden, Belege } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import { AI_PHOTO_SCAN } from '@/config/ai-features';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { BelegeDialog } from '@/components/dialogs/BelegeDialog';
import {
  IconAlertCircle, IconTool, IconRefresh, IconCheck,
  IconPlus, IconPencil, IconTrash, IconReceipt, IconClock,
  IconCircleCheck, IconArchive, IconFilter, IconFileInvoice,
  IconCurrencyEuro, IconUsers, IconCalendar, IconChevronRight,
  IconUpload, IconLock,
} from '@tabler/icons-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const APPGROUP_ID = '69eb4c69636bc03e5c7eb7e4';
const REPAIR_ENDPOINT = '/claude/build/repair';

type VerarbeitungsStatus =
  | 'hochgeladen'
  | 'ocr_ausstehend'
  | 'pruefung_erforderlich'
  | 'geprueft'
  | 'gebucht'
  | 'archiviert';

const STATUS_CONFIG: Record<VerarbeitungsStatus, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  hochgeladen: {
    label: 'Hochgeladen',
    icon: <IconReceipt size={14} className="shrink-0" />,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
  },
  ocr_ausstehend: {
    label: 'OCR ausstehend',
    icon: <IconClock size={14} className="shrink-0" />,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  pruefung_erforderlich: {
    label: 'Prüfung erforderlich',
    icon: <IconAlertCircle size={14} className="shrink-0" />,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  geprueft: {
    label: 'Geprüft',
    icon: <IconCheck size={14} className="shrink-0" />,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  gebucht: {
    label: 'Gebucht',
    icon: <IconCircleCheck size={14} className="shrink-0" />,
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  archiviert: {
    label: 'Archiviert',
    icon: <IconArchive size={14} className="shrink-0" />,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
};

const PIPELINE_STAGES: VerarbeitungsStatus[] = [
  'hochgeladen',
  'ocr_ausstehend',
  'pruefung_erforderlich',
  'geprueft',
  'gebucht',
  'archiviert',
];

export default function DashboardOverview() {
  const {
    steuerperioden, lieferanten, belege, belegpositionen: _bp, skr03Kontenplan: _skr,
    lieferantenMap, steuerperiodenMap, skr03KontenplanMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedBelege = enrichBelege(belege, { lieferantenMap, steuerperiodenMap, skr03KontenplanMap });

  const [selectedPeriode, setSelectedPeriode] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<EnrichedBelege | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EnrichedBelege | null>(null);

  const filteredBelege = useMemo(() => {
    if (selectedPeriode === 'all') return enrichedBelege;
    return enrichedBelege.filter(b => {
      const id = b.fields.steuerperiode_ref?.match(/([a-f0-9]{24})$/i)?.[1];
      return id === selectedPeriode;
    });
  }, [enrichedBelege, selectedPeriode]);

  const totalBrutto = useMemo(
    () => filteredBelege.reduce((sum, b) => sum + (b.fields.bruttobetrag ?? 0), 0),
    [filteredBelege]
  );
  const totalNetto = useMemo(
    () => filteredBelege.reduce((sum, b) => sum + (b.fields.nettobetrag ?? 0), 0),
    [filteredBelege]
  );
  const offenCount = useMemo(
    () => filteredBelege.filter(b => b.fields.zahlungsstatus?.key === 'offen').length,
    [filteredBelege]
  );

  const belegeByStatus = useMemo(() => {
    const map: Record<VerarbeitungsStatus, EnrichedBelege[]> = {
      hochgeladen: [],
      ocr_ausstehend: [],
      pruefung_erforderlich: [],
      geprueft: [],
      gebucht: [],
      archiviert: [],
    };
    for (const b of filteredBelege) {
      const s = (b.fields.verarbeitungsstatus?.key ?? 'hochgeladen') as VerarbeitungsStatus;
      if (map[s]) map[s].push(b);
    }
    return map;
  }, [filteredBelege]);

  // ALL hooks BEFORE early returns
  const handleCreate = async (fields: Belege['fields']) => {
    await LivingAppsService.createBelegeEntry(fields);
    fetchAll();
  };

  const handleEdit = async (fields: Belege['fields']) => {
    if (!editRecord) return;
    await LivingAppsService.updateBelegeEntry(editRecord.record_id, fields);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteBelegeEntry(deleteTarget.record_id);
    setDeleteTarget(null);
    fetchAll();
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const sortedPerioden = [...steuerperioden].sort((a, b) => {
    const ya = a.fields.steuerjahr ?? 0;
    const yb = b.fields.steuerjahr ?? 0;
    if (yb !== ya) return yb - ya;
    return (b.fields.quartal?.key ?? '').localeCompare(a.fields.quartal?.key ?? '');
  });

  return (
    <div className="space-y-6">
      {/* Intent Workflows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href="#/intents/beleg-erfassen" className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 border-l-4 border-l-primary no-underline">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <IconUpload size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">Beleg erfassen</p>
            <p className="text-xs text-muted-foreground truncate">Lieferant wählen → Periode → Beleg mit Positionen anlegen</p>
          </div>
          <IconChevronRight size={16} className="text-muted-foreground shrink-0" />
        </a>
        <a href="#/intents/steuerperiode-abschliessen" className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 border-l-4 border-l-primary no-underline">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <IconLock size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">Steuerperiode abschließen</p>
            <p className="text-xs text-muted-foreground truncate">Belege prüfen, Vollständigkeit kontrollieren und Periode schließen</p>
          </div>
          <IconChevronRight size={16} className="text-muted-foreground shrink-0" />
        </a>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Belegerfassung</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Belege verwalten und durch den Buchungsworkflow führen</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
            <IconFilter size={15} />
            <span className="text-sm hidden sm:inline">Periode:</span>
          </div>
          <Select value={selectedPeriode} onValueChange={setSelectedPeriode}>
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="Alle Perioden" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Perioden</SelectItem>
              {sortedPerioden.map((p) => (
                <SelectItem key={p.record_id} value={p.record_id}>
                  {p.fields.bezeichnung ?? `${p.fields.steuerjahr} ${p.fields.quartal?.label ?? ''}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => { setEditRecord(null); setDialogOpen(true); }}>
            <IconPlus size={15} className="shrink-0 mr-1" />
            <span>Neuer Beleg</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Belege gesamt"
          value={String(filteredBelege.length)}
          description={selectedPeriode === 'all' ? 'Alle Perioden' : 'Gefilterte Periode'}
          icon={<IconFileInvoice size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Brutto gesamt"
          value={totalBrutto >= 10000
            ? `${(totalBrutto / 1000).toFixed(1)}k €`
            : formatCurrency(totalBrutto)}
          description="inkl. MwSt."
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Netto gesamt"
          value={totalNetto >= 10000
            ? `${(totalNetto / 1000).toFixed(1)}k €`
            : formatCurrency(totalNetto)}
          description="exkl. MwSt."
          icon={<IconCurrencyEuro size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Offen (Zahlung)"
          value={String(offenCount)}
          description="ausstehende Zahlungen"
          icon={<IconClock size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <IconUsers size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Lieferanten</p>
            <p className="text-xl font-bold text-foreground">{lieferanten.length}</p>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
            <IconCalendar size={18} className="text-green-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Steuerperioden</p>
            <p className="text-xl font-bold text-foreground">{steuerperioden.length}</p>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-4 flex items-center gap-3 col-span-2 lg:col-span-1">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <IconAlertCircle size={18} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Prüfung erforderlich</p>
            <p className="text-xl font-bold text-foreground">{belegeByStatus.pruefung_erforderlich.length}</p>
          </div>
        </div>
      </div>

      {/* Workflow Pipeline */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-3">Workflow-Pipeline</h2>
        {filteredBelege.length === 0 ? (
          <div className="rounded-2xl border bg-card flex flex-col items-center justify-center py-16 gap-3">
            <IconFileInvoice size={48} className="text-muted-foreground" stroke={1.5} />
            <p className="text-muted-foreground text-sm">Noch keine Belege vorhanden.</p>
            <Button size="sm" variant="outline" onClick={() => { setEditRecord(null); setDialogOpen(true); }}>
              <IconPlus size={14} className="mr-1" />Ersten Beleg erfassen
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {PIPELINE_STAGES.map((stage) => {
              const cfg = STATUS_CONFIG[stage];
              const items = belegeByStatus[stage];
              return (
                <div key={stage} className={`rounded-2xl border ${cfg.border} ${cfg.bg} flex flex-col overflow-hidden`}>
                  {/* Column header */}
                  <div className={`flex items-center gap-2 px-4 py-2.5 border-b ${cfg.border}`}>
                    <span className={cfg.color}>{cfg.icon}</span>
                    <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                    <Badge variant="secondary" className="ml-auto text-xs px-1.5 py-0">
                      {items.length}
                    </Badge>
                  </div>
                  {/* Items */}
                  <div className="flex flex-col gap-2 p-2 flex-1 min-h-[80px] max-h-[420px] overflow-y-auto">
                    {items.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Keine Belege</p>
                    )}
                    {items.map((beleg) => (
                      <BelegCard
                        key={beleg.record_id}
                        beleg={beleg}
                        onEdit={() => { setEditRecord(beleg); setDialogOpen(true); }}
                        onDelete={() => setDeleteTarget(beleg)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <BelegeDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); }}
        onSubmit={editRecord ? handleEdit : handleCreate}
        defaultValues={editRecord
          ? {
            ...editRecord.fields,
            lieferant_ref: editRecord.fields.lieferant_ref,
            steuerperiode_ref: editRecord.fields.steuerperiode_ref,
          }
          : selectedPeriode !== 'all'
            ? { steuerperiode_ref: createRecordUrl(APP_IDS.STEUERPERIODEN, selectedPeriode) }
            : undefined}
        lieferantenList={lieferanten}
        steuerperiodenList={steuerperioden}
        skr03_kontenplanList={_skr}
        enablePhotoScan={AI_PHOTO_SCAN['Belege']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Beleg löschen"
        description={`Beleg ${deleteTarget?.fields.belegnummer_lieferant ?? ''} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function BelegCard({
  beleg,
  onEdit,
  onDelete,
}: {
  beleg: EnrichedBelege;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const zahlStatus = beleg.fields.zahlungsstatus?.key;
  return (
    <div className="rounded-xl bg-white border border-border shadow-sm p-3 flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">
            {beleg.fields.belegnummer_lieferant
              ? `Nr. ${beleg.fields.belegnummer_lieferant}`
              : beleg.lieferant_refName || 'Beleg'}
          </p>
          {beleg.lieferant_refName && beleg.fields.belegnummer_lieferant && (
            <p className="text-xs text-muted-foreground truncate">{beleg.lieferant_refName}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            className="p-1 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            title="Bearbeiten"
          >
            <IconPencil size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
            title="Löschen"
          >
            <IconTrash size={13} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {beleg.fields.bruttobetrag != null && (
          <span className="text-xs font-bold text-foreground">
            {formatCurrency(beleg.fields.bruttobetrag)}
          </span>
        )}
        {beleg.fields.belegtyp && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
            {beleg.fields.belegtyp.label}
          </Badge>
        )}
        {zahlStatus && (
          <Badge
            variant="secondary"
            className={`text-xs px-1.5 py-0 h-4 ${
              zahlStatus === 'bezahlt'
                ? 'bg-green-100 text-green-700'
                : zahlStatus === 'storniert'
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {beleg.fields.zahlungsstatus?.label}
          </Badge>
        )}
      </div>

      {beleg.fields.rechnungsdatum && (
        <p className="text-xs text-muted-foreground">
          {formatDate(beleg.fields.rechnungsdatum)}
          {beleg.steuerperiode_refName && ` · ${beleg.steuerperiode_refName}`}
        </p>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte laden Sie die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktieren Sie den Support.</p>}
    </div>
  );
}
