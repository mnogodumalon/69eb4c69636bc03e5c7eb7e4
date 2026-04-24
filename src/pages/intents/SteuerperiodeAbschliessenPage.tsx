import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Steuerperioden, Belege } from '@/types/app';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import {
  IconCalendar,
  IconReceipt,
  IconCircleCheck,
  IconAlertTriangle,
  IconArrowRight,
  IconLock,
  IconRefresh,
} from '@tabler/icons-react';

const STEPS = [
  { label: 'Periode wählen' },
  { label: 'Belege prüfen' },
  { label: 'Abschluss bestätigen' },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value);

const formatDate = (dateStr: string | undefined) => {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'dd.MM.yyyy');
  } catch {
    return dateStr;
  }
};

function getInitialParams() {
  const hash = window.location.hash;
  const queryIndex = hash.indexOf('?');
  const search = queryIndex >= 0 ? hash.slice(queryIndex + 1) : '';
  const params = new URLSearchParams(search);
  return {
    steuerperiodeId: params.get('steuerperiodeId') ?? null,
    step: parseInt(params.get('step') ?? '', 10) || 1,
  };
}

export default function SteuerperiodeAbschliessenPage() {
  const { steuerperioden, belege, loading, error, fetchAll } = useDashboardData();

  const initParams = useMemo(() => getInitialParams(), []);

  const [currentStep, setCurrentStep] = useState(initParams.step);
  const [selectedPeriode, setSelectedPeriode] = useState<Steuerperioden | null>(null);
  const [periodeBelege, setPeriodeBelege] = useState<Belege[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  // Deep-link: auto-select period if steuerperiodeId in URL
  useEffect(() => {
    if (!initParams.steuerperiodeId || steuerperioden.length === 0) return;
    const found = steuerperioden.find(p => p.record_id === initParams.steuerperiodeId);
    if (found && found.fields.status_periode?.key !== 'abgeschlossen') {
      setSelectedPeriode(found);
      const filtered = belege.filter(
        b => extractRecordId(b.fields.steuerperiode_ref) === found.record_id
      );
      setPeriodeBelege(filtered);
      setCurrentStep(initParams.step >= 2 ? initParams.step : 2);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steuerperioden.length, belege.length]);

  // Sync URL when step changes
  useEffect(() => {
    const hash = window.location.hash;
    const baseHash = hash.split('?')[0];
    const params = new URLSearchParams();
    if (selectedPeriode) params.set('steuerperiodeId', selectedPeriode.record_id);
    if (currentStep > 1) params.set('step', String(currentStep));
    const query = params.toString();
    const newHash = query ? `${baseHash}?${query}` : baseHash;
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search.split('?')[0] + '#' + newHash.replace(/^#/, ''));
    }
  }, [currentStep, selectedPeriode]);

  // Derived stats
  const totalBrutto = useMemo(
    () => periodeBelege.reduce((sum, b) => sum + (b.fields.bruttobetrag ?? 0), 0),
    [periodeBelege]
  );
  const totalNetto = useMemo(
    () => periodeBelege.reduce((sum, b) => sum + (b.fields.nettobetrag ?? 0), 0),
    [periodeBelege]
  );
  const totalMwst = useMemo(
    () => periodeBelege.reduce((sum, b) => sum + (b.fields.mwst_betrag ?? 0), 0),
    [periodeBelege]
  );
  const bezahltCount = useMemo(
    () =>
      periodeBelege.filter(
        b =>
          b.fields.zahlungsstatus?.key === 'bezahlt' ||
          b.fields.zahlungsstatus?.key === 'abgeschlossen'
      ).length,
    [periodeBelege]
  );
  const offenCount = useMemo(
    () =>
      periodeBelege.filter(
        b =>
          b.fields.zahlungsstatus?.key !== 'bezahlt' &&
          b.fields.zahlungsstatus?.key !== 'abgeschlossen'
      ).length,
    [periodeBelege]
  );

  const warningBelege = useMemo(
    () =>
      periodeBelege.filter(
        b =>
          !b.fields.buchungsdatum ||
          !b.fields.skr03_konto_beleg ||
          !b.fields.zahlungsstatus
      ),
    [periodeBelege]
  );

  // Only show non-abgeschlossen periods for selection
  const selectablePerioden = useMemo(
    () => steuerperioden.filter(p => p.fields.status_periode?.key !== 'abgeschlossen'),
    [steuerperioden]
  );

  function handlePeriodeSelect(id: string) {
    const found = steuerperioden.find(p => p.record_id === id) ?? null;
    setSelectedPeriode(found);
    if (found) {
      const filtered = belege.filter(
        b => extractRecordId(b.fields.steuerperiode_ref) === found.record_id
      );
      setPeriodeBelege(filtered);
    } else {
      setPeriodeBelege([]);
    }
    setCurrentStep(2);
  }

  async function handleAbschliessen() {
    if (!selectedPeriode) return;
    setSaving(true);
    setSaveError(null);
    try {
      await LivingAppsService.updateSteuerperiodenEntry(selectedPeriode.record_id, {
        status_periode: 'abgeschlossen',
      });
      await fetchAll();
      setCompleted(true);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSelectedPeriode(null);
    setPeriodeBelege([]);
    setCompleted(false);
    setSaveError(null);
    setCurrentStep(1);
  }

  return (
    <IntentWizardShell
      title="Steuerperiode abschließen"
      subtitle="Prüfe alle Belege einer Periode und schließe sie dann ab."
      steps={STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* STEP 1: Steuerperiode wählen */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Wähle eine offene oder in Bearbeitung befindliche Steuerperiode aus, die du abschließen möchtest.
          </p>
          <EntitySelectStep
            items={selectablePerioden.map(p => ({
              id: p.record_id,
              title: p.fields.bezeichnung ?? '(Ohne Bezeichnung)',
              subtitle: `Quartal ${p.fields.quartal?.label ?? ''} ${p.fields.steuerjahr ?? ''}`,
              status: p.fields.status_periode
                ? { key: p.fields.status_periode.key, label: p.fields.status_periode.label }
                : undefined,
              icon: <IconCalendar size={18} className="text-primary" />,
            }))}
            onSelect={handlePeriodeSelect}
            searchPlaceholder="Periode suchen..."
            emptyIcon={<IconCalendar size={32} />}
            emptyText="Keine offenen Steuerperioden gefunden."
          />
        </div>
      )}

      {/* STEP 2: Belege prüfen */}
      {currentStep === 2 && selectedPeriode && (
        <div className="space-y-6">
          {/* Period header */}
          <div className="rounded-xl border bg-card p-4 overflow-hidden">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconCalendar size={18} className="text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-base truncate">
                  {selectedPeriode.fields.bezeichnung ?? '(Ohne Bezeichnung)'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedPeriode.fields.quartal?.label ?? ''}{' '}
                  {selectedPeriode.fields.steuerjahr ?? ''} &middot;{' '}
                  {formatDate(selectedPeriode.fields.von)} – {formatDate(selectedPeriode.fields.bis)}
                </p>
              </div>
              {selectedPeriode.fields.status_periode && (
                <div className="ml-auto shrink-0">
                  <StatusBadge
                    statusKey={selectedPeriode.fields.status_periode.key}
                    label={selectedPeriode.fields.status_periode.label}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Warning banner */}
          {warningBelege.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <IconAlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{warningBelege.length} Beleg{warningBelege.length !== 1 ? 'e' : ''}</span>{' '}
                {warningBelege.length !== 1 ? 'haben' : 'hat'} fehlende Pflichtfelder (Buchungsdatum, SKR03-Konto oder Zahlungsstatus).
              </p>
            </div>
          )}

          {/* Stats cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card p-4 overflow-hidden">
              <p className="text-xs text-muted-foreground mb-1">Gesamt Belege</p>
              <p className="text-2xl font-bold">{periodeBelege.length}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 overflow-hidden">
              <p className="text-xs text-muted-foreground mb-1">Gesamtbetrag Brutto</p>
              <p className="text-lg font-bold truncate">{formatCurrency(totalBrutto)}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 overflow-hidden">
              <p className="text-xs text-muted-foreground mb-1">Bezahlt</p>
              <p className="text-2xl font-bold text-green-600">{bezahltCount}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 overflow-hidden">
              <p className="text-xs text-muted-foreground mb-1">Offen</p>
              <p className="text-2xl font-bold text-amber-600">{offenCount}</p>
            </div>
          </div>

          {/* Belege table */}
          {periodeBelege.length > 0 ? (
            <div className="rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Belegnummer</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rechnungsdatum</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Netto</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">MwSt</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Brutto</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Zahlungsstatus</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Verarbeitungsstatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periodeBelege.map((beleg, idx) => {
                      const hasWarning =
                        !beleg.fields.buchungsdatum ||
                        !beleg.fields.skr03_konto_beleg ||
                        !beleg.fields.zahlungsstatus;
                      return (
                        <tr
                          key={beleg.record_id}
                          className={`border-b last:border-0 ${idx % 2 === 0 ? '' : 'bg-muted/20'} ${hasWarning ? 'bg-amber-50/50' : ''}`}
                        >
                          <td className="px-4 py-3 font-medium truncate max-w-[140px]">
                            <span className="flex items-center gap-1.5">
                              {hasWarning && (
                                <IconAlertTriangle size={13} className="text-amber-500 shrink-0" />
                              )}
                              <span className="truncate">
                                {beleg.fields.belegnummer_lieferant ?? '—'}
                              </span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                            {formatDate(beleg.fields.rechnungsdatum)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {formatCurrency(beleg.fields.nettobetrag ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {formatCurrency(beleg.fields.mwst_betrag ?? 0)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                            {formatCurrency(beleg.fields.bruttobetrag ?? 0)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              statusKey={beleg.fields.zahlungsstatus?.key}
                              label={beleg.fields.zahlungsstatus?.label}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              statusKey={beleg.fields.verarbeitungsstatus?.key}
                              label={beleg.fields.verarbeitungsstatus?.label}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-8 text-center">
              <div className="flex justify-center mb-3 opacity-40">
                <IconReceipt size={32} />
              </div>
              <p className="text-sm text-muted-foreground">Keine Belege für diese Periode gefunden.</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(1)}>
              Zurück
            </Button>
            <Button onClick={() => setCurrentStep(3)}>
              Weiter zur Prüfung
              <IconArrowRight size={16} className="ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Abschluss bestätigen */}
      {currentStep === 3 && selectedPeriode && !completed && (
        <div className="space-y-6">
          {/* Final summary */}
          <div className="rounded-xl border bg-card p-5 overflow-hidden space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconLock size={18} className="text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-base truncate">
                  {selectedPeriode.fields.bezeichnung ?? '(Ohne Bezeichnung)'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {selectedPeriode.fields.quartal?.label ?? ''}{' '}
                  {selectedPeriode.fields.steuerjahr ?? ''} &middot;{' '}
                  {formatDate(selectedPeriode.fields.von)} – {formatDate(selectedPeriode.fields.bis)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t pt-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Gesamt Belege</p>
                <p className="font-semibold">{periodeBelege.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Netto gesamt</p>
                <p className="font-semibold">{formatCurrency(totalNetto)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">MwSt gesamt</p>
                <p className="font-semibold">{formatCurrency(totalMwst)}</p>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs text-muted-foreground mb-1">Brutto gesamt</p>
                <p className="text-xl font-bold">{formatCurrency(totalBrutto)}</p>
              </div>
            </div>
          </div>

          {/* Warnings box */}
          {warningBelege.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <IconAlertTriangle size={18} className="text-amber-600 shrink-0" />
                <p className="font-semibold text-amber-800 text-sm">
                  Es gibt noch {warningBelege.length} offene{' '}
                  {warningBelege.length !== 1 ? 'Probleme' : 'Problem'}.
                  Trotzdem abschließen?
                </p>
              </div>
              <p className="text-xs text-amber-700 pl-6">
                {warningBelege.length}{' '}
                {warningBelege.length !== 1 ? 'Belege haben' : 'Beleg hat'} fehlende Pflichtfelder
                (Buchungsdatum, SKR03-Konto oder Zahlungsstatus). Du kannst die Periode trotzdem abschließen,
                solltest die Fehler aber nachträglich korrigieren.
              </p>
            </div>
          )}

          {/* Error */}
          {saveError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Fehler beim Speichern: {saveError}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button variant="outline" onClick={() => setCurrentStep(2)}>
              Zurück
            </Button>
            <Button
              onClick={handleAbschliessen}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <>
                  <IconRefresh size={16} className="animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <IconLock size={16} />
                  Periode abschließen
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* COMPLETION STATE */}
      {currentStep === 3 && completed && (
        <div className="flex flex-col items-center justify-center py-12 gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <IconCircleCheck size={36} className="text-green-600" stroke={1.5} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-green-700">
              Steuerperiode wurde erfolgreich abgeschlossen!
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Die Periode wurde auf "Abgeschlossen" gesetzt und kann nicht mehr bearbeitet werden.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-5 w-full max-w-sm text-left space-y-3 overflow-hidden">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Periode</p>
              <p className="font-semibold truncate">
                {selectedPeriode?.fields.bezeichnung ?? '—'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Gesamt Belege</p>
                <p className="font-semibold">{periodeBelege.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Brutto gesamt</p>
                <p className="font-semibold truncate">{formatCurrency(totalBrutto)}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <Button variant="outline" asChild className="flex-1">
              <a href="#/steuerperioden">Neue Periode öffnen</a>
            </Button>
            <Button onClick={handleReset} className="flex-1">
              Weitere Periode abschließen
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
