import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BudgetTracker } from '@/components/BudgetTracker';
import { Button } from '@/components/ui/button';
import { LieferantenDialog } from '@/components/dialogs/LieferantenDialog';
import { SteuerperiodenDialog } from '@/components/dialogs/SteuerperiodenDialog';
import { BelegeDialog } from '@/components/dialogs/BelegeDialog';
import { BelegpositionenDialog } from '@/components/dialogs/BelegpositionenDialog';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Lieferanten, Steuerperioden, Belege, Belegpositionen, Skr03Kontenplan } from '@/types/app';
import {
  IconBuilding,
  IconCalendar,
  IconFileText,
  IconListNumbers,
  IconPlus,
  IconCheck,
  IconArrowRight,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Lieferant' },
  { label: 'Steuerperiode' },
  { label: 'Beleg' },
  { label: 'Positionen' },
];

function formatCurrency(val: number | undefined): string {
  if (val == null) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
}

export default function BelegErfassenPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Data
  const [lieferanten, setLieferanten] = useState<Lieferanten[]>([]);
  const [steuerperioden, setSteuerperioden] = useState<Steuerperioden[]>([]);
  const [belege, setBelege] = useState<Belege[]>([]);
  const [belegpositionen, setBelegpositionen] = useState<Belegpositionen[]>([]);
  const [skr03Kontenplan, setSkr03Kontenplan] = useState<Skr03Kontenplan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedLieferantId, setSelectedLieferantId] = useState<string | null>(null);
  const [selectedSteuerperiodeId, setSelectedSteuerperiodeId] = useState<string | null>(null);
  const [createdBelegId, setCreatedBelegId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Dialog open states
  const [lieferantenDialogOpen, setLieferantenDialogOpen] = useState(false);
  const [steuerperiodenDialogOpen, setSteuerperiodenDialogOpen] = useState(false);
  const [belegeDialogOpen, setBelegeDialogOpen] = useState(false);
  const [belegpositionenDialogOpen, setBelegpositionenDialogOpen] = useState(false);

  // Deep-linking: read ?lieferantId from URL on mount
  useEffect(() => {
    const lieferantId = searchParams.get('lieferantId');
    if (lieferantId) {
      setSelectedLieferantId(lieferantId);
    }
    const stepParam = parseInt(searchParams.get('step') ?? '', 10);
    if (stepParam >= 1 && stepParam <= 4) {
      setCurrentStep(stepParam);
    } else if (lieferantId) {
      setCurrentStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync step + lieferantId to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentStep > 1) {
      params.set('step', String(currentStep));
    } else {
      params.delete('step');
    }
    if (selectedLieferantId) {
      params.set('lieferantId', selectedLieferantId);
    } else {
      params.delete('lieferantId');
    }
    setSearchParams(params, { replace: true });
  }, [currentStep, selectedLieferantId, setSearchParams, searchParams]);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [lief, steuer, bel, belpos, skr] = await Promise.all([
        LivingAppsService.getLieferanten(),
        LivingAppsService.getSteuerperioden(),
        LivingAppsService.getBelege(),
        LivingAppsService.getBelegpositionen(),
        LivingAppsService.getSkr03Kontenplan(),
      ]);
      setLieferanten(lief);
      setSteuerperioden(steuer);
      setBelege(bel);
      setBelegpositionen(belpos);
      setSkr03Kontenplan(skr);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  // Derived values
  const selectedLieferant = lieferanten.find(l => l.record_id === selectedLieferantId) ?? null;
  const selectedSteuerperiode = steuerperioden.find(s => s.record_id === selectedSteuerperiodeId) ?? null;
  const createdBeleg = belege.find(b => b.record_id === createdBelegId) ?? null;

  const openPerioden = steuerperioden.filter(
    s => s.fields.status_periode?.key !== 'abgeschlossen'
  );

  const createdBelegPositionen: Belegpositionen[] = createdBelegId
    ? belegpositionen.filter(pos => {
        const refId = extractRecordId(pos.fields.beleg_ref);
        return refId === createdBelegId;
      })
    : [];

  const sumNetto = createdBelegPositionen.reduce(
    (acc, p) => acc + (p.fields.nettobetrag_pos ?? 0), 0
  );
  const sumBrutto = createdBelegPositionen.reduce(
    (acc, p) => acc + (p.fields.bruttobetrag_pos ?? 0), 0
  );

  // Step navigation
  function goToStep(step: number) {
    setCurrentStep(step);
  }

  function resetWizard() {
    setCurrentStep(1);
    setSelectedLieferantId(null);
    setSelectedSteuerperiodeId(null);
    setCreatedBelegId(null);
    setDone(false);
  }

  // Handlers
  async function handleSelectLieferant(id: string) {
    setSelectedLieferantId(id);
    goToStep(2);
  }

  async function handleCreateLieferant(fields: Lieferanten['fields']) {
    const result = await LivingAppsService.createLieferantenEntry(fields);
    await fetchAll();
    if (result?.id) {
      setSelectedLieferantId(result.id);
      goToStep(2);
    }
    setLieferantenDialogOpen(false);
  }

  async function handleSelectSteuerperiode(id: string) {
    setSelectedSteuerperiodeId(id);
    goToStep(3);
  }

  async function handleCreateSteuerperiode(fields: Steuerperioden['fields']) {
    const result = await LivingAppsService.createSteuerperiodenEntry(fields);
    await fetchAll();
    if (result?.id) {
      setSelectedSteuerperiodeId(result.id);
      goToStep(3);
    }
    setSteuerperiodenDialogOpen(false);
  }

  async function handleCreateBeleg(fields: Belege['fields']) {
    const result = await LivingAppsService.createBelegeEntry(fields);
    await fetchAll();
    if (result?.id) {
      setCreatedBelegId(result.id);
    }
    setBelegeDialogOpen(false);
  }

  async function handleCreateBelegposition(fields: Belegpositionen['fields']) {
    await LivingAppsService.createBelegpositionenEntry(fields);
    await fetchAll();
    setBelegpositionenDialogOpen(false);
  }

  // Completion state
  if (done && createdBeleg) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <a href="#/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
            Zuruck zum Dashboard
          </a>
          <h1 className="text-2xl font-bold tracking-tight">Beleg erfassen</h1>
        </div>
        <div className="rounded-2xl border bg-card p-8 flex flex-col items-center gap-6 text-center overflow-hidden">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <IconCheck size={32} className="text-green-600" stroke={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Beleg erfolgreich erfasst!</h2>
            <p className="text-sm text-muted-foreground">Der Beleg wurde angelegt und ist jetzt verfugbar.</p>
          </div>
          <div className="w-full max-w-sm rounded-xl border bg-muted/30 p-4 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Lieferant</span>
              <span className="font-medium truncate ml-4">{selectedLieferant?.fields.name ?? '–'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Belegnummer</span>
              <span className="font-medium truncate ml-4">{createdBeleg.fields.belegnummer_lieferant ?? '–'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bruttobetrag</span>
              <span className="font-semibold">{formatCurrency(createdBeleg.fields.bruttobetrag)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Positionen</span>
              <span className="font-medium">{createdBelegPositionen.length}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <Button variant="outline" className="flex-1" onClick={resetWizard}>
              <IconPlus size={16} className="mr-2" />
              Weiteren Beleg erfassen
            </Button>
            <Button className="flex-1" asChild>
              <a href="#/belege">Zur Ubersicht</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title="Beleg erfassen"
      subtitle="Lieferant wahlen, Steuerperiode zuordnen und Beleg anlegen"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={goToStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Lieferant wahlen */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Lieferant wahlen</h2>
            <p className="text-sm text-muted-foreground">Wahle den Lieferanten fur diesen Beleg aus oder lege einen neuen an.</p>
          </div>
          <EntitySelectStep
            items={lieferanten.map(l => ({
              id: l.record_id,
              title: l.fields.name ?? '(Kein Name)',
              subtitle: [l.fields.plz, l.fields.ort].filter(Boolean).join(' ') || undefined,
              icon: <IconBuilding size={18} className="text-primary" />,
            }))}
            onSelect={handleSelectLieferant}
            searchPlaceholder="Lieferant suchen..."
            emptyIcon={<IconBuilding size={32} />}
            emptyText="Noch keine Lieferanten vorhanden. Lege jetzt den ersten an."
            createLabel="Neuen Lieferanten anlegen"
            onCreateNew={() => setLieferantenDialogOpen(true)}
            createDialog={
              <LieferantenDialog
                open={lieferantenDialogOpen}
                onClose={() => setLieferantenDialogOpen(false)}
                onSubmit={handleCreateLieferant}
                skr03_kontenplanList={skr03Kontenplan}
              />
            }
          />
        </div>
      )}

      {/* Step 2: Steuerperiode wahlen */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold mb-1">Steuerperiode wahlen</h2>
              <p className="text-sm text-muted-foreground">Wahle die zugehorige Steuerperiode fur diesen Beleg.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => goToStep(1)}>
              Zurück
            </Button>
          </div>

          {/* Selected Lieferant badge */}
          {selectedLieferant && (
            <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-4 py-3 overflow-hidden">
              <IconBuilding size={16} className="text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">{selectedLieferant.fields.name}</span>
              {selectedLieferant.fields.ort && (
                <span className="text-sm text-muted-foreground truncate">· {selectedLieferant.fields.ort}</span>
              )}
            </div>
          )}

          <EntitySelectStep
            items={openPerioden.map(s => ({
              id: s.record_id,
              title: s.fields.bezeichnung ?? '(Kein Name)',
              subtitle: s.fields.steuerjahr ? String(s.fields.steuerjahr) : undefined,
              status: s.fields.status_periode
                ? { key: s.fields.status_periode.key, label: s.fields.status_periode.label }
                : undefined,
              icon: <IconCalendar size={18} className="text-primary" />,
            }))}
            onSelect={handleSelectSteuerperiode}
            searchPlaceholder="Steuerperiode suchen..."
            emptyIcon={<IconCalendar size={32} />}
            emptyText="Keine offenen Steuerperioden vorhanden. Lege eine neue an."
            createLabel="Neue Steuerperiode anlegen"
            onCreateNew={() => setSteuerperiodenDialogOpen(true)}
            createDialog={
              <SteuerperiodenDialog
                open={steuerperiodenDialogOpen}
                onClose={() => setSteuerperiodenDialogOpen(false)}
                onSubmit={handleCreateSteuerperiode}
              />
            }
          />
        </div>
      )}

      {/* Step 3: Beleg anlegen */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold mb-1">Beleg anlegen</h2>
              <p className="text-sm text-muted-foreground">Erstelle den Beleg mit allen relevanten Informationen.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => goToStep(2)}>
              Zurück
            </Button>
          </div>

          {/* Summary card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-muted/30 p-4 overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <IconBuilding size={14} className="text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Lieferant</span>
              </div>
              <p className="font-semibold truncate">{selectedLieferant?.fields.name ?? '–'}</p>
              {selectedLieferant?.fields.ort && (
                <p className="text-sm text-muted-foreground truncate">{selectedLieferant.fields.ort}</p>
              )}
            </div>
            <div className="rounded-xl border bg-muted/30 p-4 overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <IconCalendar size={14} className="text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Steuerperiode</span>
              </div>
              <p className="font-semibold truncate">{selectedSteuerperiode?.fields.bezeichnung ?? '–'}</p>
              {selectedSteuerperiode?.fields.steuerjahr && (
                <p className="text-sm text-muted-foreground">{selectedSteuerperiode.fields.steuerjahr}</p>
              )}
            </div>
          </div>

          {createdBelegId && createdBeleg ? (
            /* Beleg already created — show details and navigation */
            <div className="space-y-4">
              <div className="rounded-xl border bg-green-50 border-green-200 p-4 overflow-hidden">
                <div className="flex items-center gap-2 mb-3">
                  <IconCheck size={16} className="text-green-600 shrink-0" />
                  <span className="text-sm font-semibold text-green-800">Beleg erfolgreich angelegt</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Belegnummer: </span>
                    <span className="font-medium">{createdBeleg.fields.belegnummer_lieferant ?? '–'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Bruttobetrag: </span>
                    <span className="font-semibold">{formatCurrency(createdBeleg.fields.bruttobetrag)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="flex-1"
                  onClick={() => goToStep(4)}
                >
                  <IconListNumbers size={16} className="mr-2" />
                  Belegpositionen hinzufugen
                  <IconArrowRight size={16} className="ml-2" />
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setDone(true)}
                >
                  <IconCheck size={16} className="mr-2" />
                  Fertig (ohne Positionen)
                </Button>
              </div>
            </div>
          ) : (
            /* No beleg yet — show create button */
            <div className="rounded-xl border border-dashed p-8 flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <IconFileText size={22} className="text-primary" />
              </div>
              <div>
                <p className="font-medium">Beleg noch nicht angelegt</p>
                <p className="text-sm text-muted-foreground mt-1">Klicke auf "Beleg erstellen", um den Beleg anzulegen.</p>
              </div>
              <Button onClick={() => setBelegeDialogOpen(true)}>
                <IconPlus size={16} className="mr-2" />
                Beleg erstellen
              </Button>
            </div>
          )}

          <BelegeDialog
            open={belegeDialogOpen}
            onClose={() => setBelegeDialogOpen(false)}
            onSubmit={handleCreateBeleg}
            defaultValues={
              selectedLieferantId && selectedSteuerperiodeId
                ? {
                    lieferant_ref: createRecordUrl(APP_IDS.LIEFERANTEN, selectedLieferantId),
                    steuerperiode_ref: createRecordUrl(APP_IDS.STEUERPERIODEN, selectedSteuerperiodeId),
                  }
                : undefined
            }
            lieferantenList={lieferanten}
            steuerperiodenList={steuerperioden}
            skr03_kontenplanList={skr03Kontenplan}
          />
        </div>
      )}

      {/* Step 4: Belegpositionen hinzufugen */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold mb-1">Belegpositionen hinzufugen</h2>
              <p className="text-sm text-muted-foreground">Fuge einzelne Positionen zu deinem Beleg hinzu.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => goToStep(3)}>
              Zurück
            </Button>
          </div>

          {/* Beleg summary */}
          {createdBeleg && (
            <div className="rounded-xl border bg-muted/30 p-4 overflow-hidden">
              <div className="flex items-center gap-2 mb-1">
                <IconFileText size={14} className="text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Beleg</span>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="font-semibold truncate">{createdBeleg.fields.belegnummer_lieferant ?? '(Kein Belegnummer)'}</p>
                <p className="font-semibold text-primary">{formatCurrency(createdBeleg.fields.bruttobetrag)}</p>
              </div>
            </div>
          )}

          {/* Budget Tracker */}
          <BudgetTracker
            budget={createdBeleg?.fields.bruttobetrag ?? 0}
            booked={sumBrutto}
            label="Positionen vs. Beleg (Brutto)"
          />

          {/* Netto total */}
          <div className="rounded-xl border bg-card p-4 flex items-center justify-between text-sm overflow-hidden">
            <span className="text-muted-foreground">Summe Netto (Positionen)</span>
            <span className="font-semibold">{formatCurrency(sumNetto)}</span>
          </div>

          {/* Positions list */}
          {createdBelegPositionen.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Positionen ({createdBelegPositionen.length})
              </h3>
              <div className="space-y-2">
                {createdBelegPositionen.map((pos, idx) => (
                  <div
                    key={pos.record_id}
                    className="rounded-xl border bg-card p-4 overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground shrink-0">
                            #{pos.fields.positionsnummer ?? idx + 1}
                          </span>
                          <span className="font-medium text-sm truncate">
                            {pos.fields.bezeichnung_pos ?? '(Keine Bezeichnung)'}
                          </span>
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          {pos.fields.menge != null && (
                            <span>Menge: <span className="font-medium text-foreground">{pos.fields.menge} {pos.fields.einheit ?? ''}</span></span>
                          )}
                          {pos.fields.einzelpreis_netto != null && (
                            <span>EP: <span className="font-medium text-foreground">{formatCurrency(pos.fields.einzelpreis_netto)}</span></span>
                          )}
                          {pos.fields.mwst_satz_pos?.label && (
                            <span>MwSt: <span className="font-medium text-foreground">{pos.fields.mwst_satz_pos.label}</span></span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">{formatCurrency(pos.fields.bruttobetrag_pos)}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(pos.fields.nettobetrag_pos)} netto</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 flex flex-col items-center gap-3 text-center">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <IconListNumbers size={18} className="text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Noch keine Positionen vorhanden. Fuge die erste Position hinzu.</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setBelegpositionenDialogOpen(true)}
            >
              <IconPlus size={16} className="mr-2" />
              Position hinzufugen
            </Button>
            <Button
              className="flex-1"
              onClick={() => setDone(true)}
            >
              <IconCheck size={16} className="mr-2" />
              Fertig
            </Button>
          </div>

          <BelegpositionenDialog
            open={belegpositionenDialogOpen}
            onClose={() => setBelegpositionenDialogOpen(false)}
            onSubmit={handleCreateBelegposition}
            defaultValues={
              createdBelegId
                ? { beleg_ref: createRecordUrl(APP_IDS.BELEGE, createdBelegId) }
                : undefined
            }
            belegeList={belege}
            skr03_kontenplanList={skr03Kontenplan}
          />
        </div>
      )}
    </IntentWizardShell>
  );
}
