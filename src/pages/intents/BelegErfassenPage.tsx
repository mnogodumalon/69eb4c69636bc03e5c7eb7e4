import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { BudgetTracker } from '@/components/BudgetTracker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LieferantenDialog } from '@/components/dialogs/LieferantenDialog';
import { SteuerperiodenDialog } from '@/components/dialogs/SteuerperiodenDialog';
import { BelegpositionenDialog } from '@/components/dialogs/BelegpositionenDialog';
import { LivingAppsService, createRecordUrl, extractRecordId, uploadFile } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Lieferanten, Steuerperioden, Belege, Belegpositionen, Skr03Kontenplan } from '@/types/app';
import { fileToDataUri, extractFromInput, dataUriToBlob } from '@/lib/ai';
import {
  IconBuilding,
  IconCalendar,
  IconListNumbers,
  IconPlus,
  IconCheck,
  IconArrowRight,
  IconUpload,
  IconSparkles,
  IconFileText,
  IconLoader2,
  IconReceipt,
  IconCamera,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Einlesen' },
  { label: 'Lieferant' },
  { label: 'Periode' },
  { label: 'Positionen' },
];

interface ExtractedBelegData {
  lieferant_name?: string;
  lieferant_strasse?: string;
  lieferant_plz?: string;
  lieferant_ort?: string;
  belegnummer_lieferant?: string;
  rechnungsdatum?: string;
  bruttobetrag?: number;
  nettobetrag?: number;
  mwst_betrag?: number;
  belegtyp?: string;
}

function fmtCurrency(val: number | undefined): string {
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

  // Step 1: File / extraction state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedBelegData | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Dialog open states
  const [lieferantenDialogOpen, setLieferantenDialogOpen] = useState(false);
  const [steuerperiodenDialogOpen, setSteuerperiodenDialogOpen] = useState(false);
  const [belegpositionenDialogOpen, setBelegpositionenDialogOpen] = useState(false);

  // Step 4: Beleg creation state
  const [creatingBeleg, setCreatingBeleg] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Deep-linking
  useEffect(() => {
    const stepParam = parseInt(searchParams.get('step') ?? '', 10);
    if (stepParam >= 1 && stepParam <= 4) setCurrentStep(stepParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentStep > 1) params.set('step', String(currentStep));
    else params.delete('step');
    setSearchParams(params, { replace: true });
  }, [currentStep, setSearchParams, searchParams]);

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
    ? belegpositionen.filter(pos => extractRecordId(pos.fields.beleg_ref) === createdBelegId)
    : [];

  const sumNetto = createdBelegPositionen.reduce((acc, p) => acc + (p.fields.nettobetrag_pos ?? 0), 0);
  const sumBrutto = createdBelegPositionen.reduce((acc, p) => acc + (p.fields.bruttobetrag_pos ?? 0), 0);

  // Auto-create Beleg when entering step 4
  useEffect(() => {
    if (currentStep !== 4 || createdBelegId || creatingBeleg) return;
    if (!selectedLieferantId || !selectedSteuerperiodeId) return;
    void handleAutoCreateBeleg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // Wizard helpers
  function goToStep(step: number) { setCurrentStep(step); }

  function resetWizard() {
    setCurrentStep(1);
    setSelectedLieferantId(null);
    setSelectedSteuerperiodeId(null);
    setCreatedBelegId(null);
    setUploadedFile(null);
    setFilePreview(null);
    setFileUrl(null);
    setExtractedData(null);
    setDone(false);
  }

  // File handling
  async function handleFileAccepted(file: File) {
    setUploadedFile(file);
    setExtractedData(null);

    // Show preview for images
    if (file.type.startsWith('image/')) {
      const uri = await fileToDataUri(file);
      setFilePreview(uri);
      extractFromFile(file, uri);
    } else {
      setFilePreview(null);
      const uri = await fileToDataUri(file);
      extractFromFile(file, uri);
    }
  }

  async function extractFromFile(file: File, uri: string) {
    setExtracting(true);
    try {
      // Upload file in parallel with extraction
      const uploadPromise = uploadFile(dataUriToBlob(uri), file.name).catch(() => null);

      const schema = `{
  "lieferant_name": "string | null",
  "lieferant_strasse": "string | null",
  "lieferant_plz": "string | null",
  "lieferant_ort": "string | null",
  "belegnummer_lieferant": "string | null",
  "rechnungsdatum": "YYYY-MM-DD | null",
  "bruttobetrag": "number | null",
  "nettobetrag": "number | null",
  "mwst_betrag": "number | null",
  "belegtyp": "rechnung | quittung | kassenbon | gutschrift | kontoauszug | sonstiges | null"
}`;

      const [extracted, uploadedUrl] = await Promise.all([
        extractFromInput<ExtractedBelegData>(schema, {
          dataUri: uri,
          intent: 'Steuerbeleg einlesen – Lieferant, Beträge und Datum extrahieren',
        }),
        uploadPromise,
      ]);

      setExtractedData(extracted);
      if (uploadedUrl) setFileUrl(uploadedUrl);
    } catch (err) {
      console.error('Extraktion fehlgeschlagen:', err);
      setExtractedData({});
    } finally {
      setExtracting(false);
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFileAccepted(f);
    e.target.value = '';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFileAccepted(file);
  }

  // Step handlers
  async function handleSelectLieferant(id: string) {
    setSelectedLieferantId(id);
    goToStep(3);
  }

  async function handleCreateLieferant(fields: Lieferanten['fields']) {
    const result = await LivingAppsService.createLieferantenEntry(fields);
    await fetchAll();
    if (result?.id) {
      setSelectedLieferantId(result.id);
      goToStep(3);
    }
    setLieferantenDialogOpen(false);
  }

  async function handleSelectSteuerperiode(id: string) {
    setSelectedSteuerperiodeId(id);
    goToStep(4);
  }

  async function handleCreateSteuerperiode(fields: Steuerperioden['fields']) {
    const result = await LivingAppsService.createSteuerperiodenEntry(fields);
    await fetchAll();
    if (result?.id) {
      setSelectedSteuerperiodeId(result.id);
      goToStep(4);
    }
    setSteuerperiodenDialogOpen(false);
  }

  async function handleAutoCreateBeleg() {
    if (!selectedLieferantId || !selectedSteuerperiodeId) return;
    setCreatingBeleg(true);
    try {
      const belegtypMap: Record<string, { key: string; label: string }> = {
        rechnung: { key: 'rechnung', label: 'Rechnung' },
        quittung: { key: 'quittung', label: 'Quittung' },
        kassenbon: { key: 'kassenbon', label: 'Kassenbon' },
        gutschrift: { key: 'gutschrift', label: 'Gutschrift' },
        kontoauszug: { key: 'kontoauszug', label: 'Kontoauszug' },
        sonstiges: { key: 'sonstiges', label: 'Sonstiges' },
      };

      const fields: Belege['fields'] = {
        lieferant_ref: createRecordUrl(APP_IDS.LIEFERANTEN, selectedLieferantId),
        steuerperiode_ref: createRecordUrl(APP_IDS.STEUERPERIODEN, selectedSteuerperiodeId),
        ...(fileUrl ? { beleg_datei: fileUrl } : {}),
        ...(extractedData?.belegnummer_lieferant ? { belegnummer_lieferant: extractedData.belegnummer_lieferant } : {}),
        ...(extractedData?.rechnungsdatum ? { rechnungsdatum: extractedData.rechnungsdatum } : {}),
        ...(extractedData?.bruttobetrag != null ? { bruttobetrag: extractedData.bruttobetrag } : {}),
        ...(extractedData?.nettobetrag != null ? { nettobetrag: extractedData.nettobetrag } : {}),
        ...(extractedData?.mwst_betrag != null ? { mwst_betrag: extractedData.mwst_betrag } : {}),
        ...(extractedData?.belegtyp && belegtypMap[extractedData.belegtyp]
          ? { belegtyp: belegtypMap[extractedData.belegtyp] }
          : {}),
        verarbeitungsstatus: { key: 'hochgeladen', label: 'Hochgeladen' },
      };

      const result = await LivingAppsService.createBelegeEntry(fields);
      await fetchAll();
      if (result?.id) setCreatedBelegId(result.id);
    } catch (err) {
      console.error('Beleg erstellen fehlgeschlagen:', err);
    } finally {
      setCreatingBeleg(false);
    }
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
            Zurück zum Dashboard
          </a>
          <h1 className="text-2xl font-bold tracking-tight">Beleg erfassen</h1>
        </div>
        <div className="rounded-2xl border bg-card p-8 flex flex-col items-center gap-6 text-center overflow-hidden">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <IconCheck size={32} className="text-green-600" stroke={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Beleg erfolgreich erfasst!</h2>
            <p className="text-sm text-muted-foreground">Der Beleg wurde angelegt und ist jetzt verfügbar.</p>
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
              <span className="font-semibold">{fmtCurrency(createdBeleg.fields.bruttobetrag)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Positionen</span>
              <span className="font-medium">{createdBelegPositionen.length}</span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <Button variant="outline" className="flex-1" onClick={resetWizard}>
              <IconPlus size={16} className="mr-2 shrink-0" />
              Weiteren Beleg erfassen
            </Button>
            <Button className="flex-1" asChild>
              <a href="#/belege">Zur Übersicht</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title="Beleg erfassen"
      subtitle="Beleg einlesen, Lieferant zuordnen und Steuerperiode wählen"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={goToStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Beleg einlesen ── */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Beleg einlesen</h2>
            <p className="text-sm text-muted-foreground">
              Lade den Beleg hoch – die KI erkennt automatisch Lieferant, Beträge und Datum.
            </p>
          </div>

          {/* Drop zone */}
          {!uploadedFile ? (
            <div
              className={`rounded-2xl border-2 border-dashed transition-colors p-8 flex flex-col items-center gap-4 text-center cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <IconUpload size={26} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Beleg hier ablegen oder antippen</p>
                <p className="text-sm text-muted-foreground mt-1">Foto, PDF oder gescannte Rechnung</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  <IconUpload size={14} className="mr-1.5 shrink-0" />
                  Datei wählen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                >
                  <IconCamera size={14} className="mr-1.5 shrink-0" />
                  Foto aufnehmen
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileInputChange}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          ) : (
            /* File selected – show preview + extraction result */
            <div className="space-y-3">
              {/* File card */}
              <div className="rounded-xl border bg-card p-4 flex items-center gap-3 overflow-hidden">
                {filePreview ? (
                  <img
                    src={filePreview}
                    alt="Beleg"
                    className="w-16 h-20 object-cover rounded-lg border shrink-0"
                  />
                ) : (
                  <div className="w-16 h-20 rounded-lg border bg-muted flex items-center justify-center shrink-0">
                    <IconFileText size={24} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{uploadedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(uploadedFile.size / 1024).toFixed(0)} KB</p>
                  {extracting && (
                    <div className="flex items-center gap-1.5 mt-2 text-primary">
                      <IconLoader2 size={13} className="animate-spin shrink-0" />
                      <span className="text-xs">KI liest Beleg aus…</span>
                    </div>
                  )}
                  {!extracting && extractedData && (
                    <div className="flex items-center gap-1.5 mt-2 text-green-600">
                      <IconSparkles size={13} className="shrink-0" />
                      <span className="text-xs font-medium">Daten erkannt</span>
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => {
                    setUploadedFile(null);
                    setFilePreview(null);
                    setFileUrl(null);
                    setExtractedData(null);
                  }}
                >
                  Ändern
                </Button>
              </div>

              {/* Extracted data summary */}
              {extractedData && !extracting && (
                <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    <IconSparkles size={13} className="shrink-0 text-primary" />
                    Erkannte Daten
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 text-sm">
                    {extractedData.lieferant_name && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Lieferant</span>
                        <span className="font-medium truncate">{extractedData.lieferant_name}</span>
                      </div>
                    )}
                    {extractedData.belegnummer_lieferant && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Belegnr.</span>
                        <span className="font-medium truncate">{extractedData.belegnummer_lieferant}</span>
                      </div>
                    )}
                    {extractedData.rechnungsdatum && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Datum</span>
                        <span className="font-medium">{extractedData.rechnungsdatum}</span>
                      </div>
                    )}
                    {extractedData.bruttobetrag != null && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Brutto</span>
                        <span className="font-semibold text-foreground">{fmtCurrency(extractedData.bruttobetrag)}</span>
                      </div>
                    )}
                    {extractedData.nettobetrag != null && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Netto</span>
                        <span className="font-medium">{fmtCurrency(extractedData.nettobetrag)}</span>
                      </div>
                    )}
                    {extractedData.belegtyp && (
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground shrink-0">Belegtyp</span>
                        <Badge variant="secondary" className="text-xs capitalize">{extractedData.belegtyp}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <div />
            <Button
              onClick={() => goToStep(2)}
              disabled={!uploadedFile || extracting}
            >
              Weiter: Lieferant
              <IconArrowRight size={16} className="ml-2 shrink-0" />
            </Button>
          </div>

          {/* Skip option */}
          {!uploadedFile && (
            <p className="text-center text-xs text-muted-foreground">
              Kein Dokument vorhanden?{' '}
              <button
                className="text-primary hover:underline"
                onClick={() => goToStep(2)}
              >
                Ohne Beleg weiter
              </button>
            </p>
          )}
        </div>
      )}

      {/* ── Step 2: Lieferant ── */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold mb-1">Lieferant eintragen</h2>
              <p className="text-sm text-muted-foreground">
                Wähle den Lieferanten aus oder lege einen neuen an.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => goToStep(1)}>
              Zurück
            </Button>
          </div>

          {/* Extracted supplier hint */}
          {extractedData?.lieferant_name && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-start gap-3 overflow-hidden">
              <IconSparkles size={16} className="text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {extractedData.lieferant_name}
                </p>
                {(extractedData.lieferant_strasse || extractedData.lieferant_ort) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {[extractedData.lieferant_strasse, extractedData.lieferant_plz, extractedData.lieferant_ort]
                      .filter(Boolean)
                      .join(' ')}
                  </p>
                )}
                <p className="text-xs text-primary mt-0.5">Aus dem Beleg erkannt – wähle unten oder lege neu an</p>
              </div>
            </div>
          )}

          <EntitySelectStep
            items={lieferanten.map(l => ({
              id: l.record_id,
              title: l.fields.name ?? '(Kein Name)',
              subtitle: [l.fields.plz, l.fields.ort].filter(Boolean).join(' ') || undefined,
              icon: <IconBuilding size={18} className="text-primary" />,
            }))}
            onSelect={handleSelectLieferant}
            searchPlaceholder="Lieferant suchen…"
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
                defaultValues={
                  extractedData?.lieferant_name
                    ? {
                        name: extractedData.lieferant_name,
                        strasse: extractedData.lieferant_strasse,
                        plz: extractedData.lieferant_plz,
                        ort: extractedData.lieferant_ort,
                      }
                    : undefined
                }
              />
            }
          />
        </div>
      )}

      {/* ── Step 3: Steuerperiode ── */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold mb-1">Steuerperiode zuordnen</h2>
              <p className="text-sm text-muted-foreground">
                Wähle die Steuerperiode, zu der dieser Beleg gehört.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => goToStep(2)}>
              Zurück
            </Button>
          </div>

          {/* Selected supplier badge */}
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
            searchPlaceholder="Steuerperiode suchen…"
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

      {/* ── Step 4: Positionen ── */}
      {currentStep === 4 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold mb-1">Positionen</h2>
              <p className="text-sm text-muted-foreground">
                Der Beleg wird angelegt. Füge Positionen hinzu oder schließe direkt ab.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => goToStep(3)}>
              Zurück
            </Button>
          </div>

          {/* Beleg creation / loading state */}
          {creatingBeleg && (
            <div className="rounded-xl border bg-muted/30 p-6 flex flex-col items-center gap-3 text-center">
              <IconLoader2 size={28} className="text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Beleg wird angelegt…</p>
            </div>
          )}

          {/* Beleg summary */}
          {!creatingBeleg && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border bg-muted/30 p-4 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <IconBuilding size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Lieferant</span>
                </div>
                <p className="font-semibold text-sm truncate">{selectedLieferant?.fields.name ?? '–'}</p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-4 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <IconCalendar size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Periode</span>
                </div>
                <p className="font-semibold text-sm truncate">{selectedSteuerperiode?.fields.bezeichnung ?? '–'}</p>
              </div>
              <div className="rounded-xl border bg-muted/30 p-4 overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <IconReceipt size={14} className="text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Bruttobetrag</span>
                </div>
                <p className="font-semibold text-sm">{fmtCurrency(createdBeleg?.fields.bruttobetrag ?? extractedData?.bruttobetrag)}</p>
              </div>
            </div>
          )}

          {/* Budget tracker (only if beleg has an amount) */}
          {!creatingBeleg && (createdBeleg?.fields.bruttobetrag ?? 0) > 0 && (
            <BudgetTracker
              budget={createdBeleg?.fields.bruttobetrag ?? 0}
              booked={sumBrutto}
              label="Positionen vs. Beleg (Brutto)"
            />
          )}

          {/* Netto sum */}
          {!creatingBeleg && sumNetto > 0 && (
            <div className="rounded-xl border bg-card p-4 flex items-center justify-between text-sm overflow-hidden">
              <span className="text-muted-foreground">Summe Netto (Positionen)</span>
              <span className="font-semibold">{fmtCurrency(sumNetto)}</span>
            </div>
          )}

          {/* Positions list */}
          {!creatingBeleg && (
            <>
              {createdBelegPositionen.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Positionen ({createdBelegPositionen.length})
                  </h3>
                  <div className="space-y-2">
                    {createdBelegPositionen.map((pos, idx) => (
                      <div key={pos.record_id} className="rounded-xl border bg-card p-4 overflow-hidden">
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
                                <span>EP: <span className="font-medium text-foreground">{fmtCurrency(pos.fields.einzelpreis_netto)}</span></span>
                              )}
                              {pos.fields.mwst_satz_pos?.label && (
                                <span>MwSt: <span className="font-medium text-foreground">{pos.fields.mwst_satz_pos.label}</span></span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-semibold text-sm">{fmtCurrency(pos.fields.bruttobetrag_pos)}</p>
                            <p className="text-xs text-muted-foreground">{fmtCurrency(pos.fields.nettobetrag_pos)} netto</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 flex flex-col items-center gap-3 text-center">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                    <IconListNumbers size={18} className="text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Keine Positionen vorhanden. Füge sie hinzu oder schließe den Beleg direkt ab.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setBelegpositionenDialogOpen(true)}
                  disabled={!createdBelegId}
                >
                  <IconPlus size={16} className="mr-2 shrink-0" />
                  Position hinzufügen
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setDone(true)}
                  disabled={!createdBelegId}
                >
                  <IconCheck size={16} className="mr-2 shrink-0" />
                  Fertig
                </Button>
              </div>
            </>
          )}

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
