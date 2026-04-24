import { useState, useEffect, useRef, useCallback } from 'react';
import type { Leasingvertraege, Lieferanten, Skr03Kontenplan } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, getUserProfile } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { IconArrowBigDownLinesFilled, IconCamera, IconCircleCheck, IconClipboard, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode } from '@/lib/ai';
import { lookupKey } from '@/lib/formatters';

interface LeasingvertraegeDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Leasingvertraege['fields']) => Promise<void>;
  defaultValues?: Leasingvertraege['fields'];
  lieferantenList: Lieferanten[];
  skr03_kontenplanList: Skr03Kontenplan[];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

export function LeasingvertraegeDialog({ open, onClose, onSubmit, defaultValues, lieferantenList, skr03_kontenplanList, enablePhotoScan = true, enablePhotoLocation = true }: LeasingvertraegeDialogProps) {
  const [fields, setFields] = useState<Partial<Leasingvertraege['fields']>>({});
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [usePersonalInfo, setUsePersonalInfo] = useState(() => {
    try { return localStorage.getItem('ai-use-personal-info') === 'true'; } catch { return false; }
  });
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  useEffect(() => {
    if (open) {
      setFields(defaultValues ?? {});
      setPreview(null);
      setScanSuccess(false);
      setAiText('');
    }
  }, [open, defaultValues]);
  useEffect(() => {
    try { localStorage.setItem('ai-use-personal-info', String(usePersonalInfo)); } catch {}
  }, [usePersonalInfo]);
  async function handleShowProfileInfo() {
    if (showProfileInfo) { setShowProfileInfo(false); return; }
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfileData(p);
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
      setShowProfileInfo(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const clean = cleanFieldsForApi({ ...fields }, 'leasingvertraege');
      await onSubmit(clean as Leasingvertraege['fields']);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleAiExtract(file?: File) {
    if (!file && !aiText.trim()) return;
    setScanning(true);
    setScanSuccess(false);
    try {
      let uri: string | undefined;
      let gps: { latitude: number; longitude: number } | null = null;
      let geoAddr = '';
      const parts: string[] = [];
      if (file) {
        const [dataUri, meta] = await Promise.all([fileToDataUri(file), extractPhotoMeta(file)]);
        uri = dataUri;
        if (file.type.startsWith('image/')) setPreview(uri);
        gps = enablePhotoLocation ? meta?.gps ?? null : null;
        if (gps) {
          geoAddr = await reverseGeocode(gps.latitude, gps.longitude);
          parts.push(`Location coordinates: ${gps.latitude}, ${gps.longitude}`);
          if (geoAddr) parts.push(`Reverse-geocoded address: ${geoAddr}`);
        }
        if (meta?.dateTime) {
          parts.push(`Date taken: ${meta.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')}`);
        }
      }
      const contextParts: string[] = [];
      if (parts.length) {
        contextParts.push(`<photo-metadata>\nThe following metadata was extracted from the photo\'s EXIF data:\n${parts.join('\n')}\n</photo-metadata>`);
      }
      contextParts.push(`<available-records field="leasinggeber" entity="Lieferanten">\n${JSON.stringify(lieferantenList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="skr03_konto_leasing" entity="SKR03-Kontenplan">\n${JSON.stringify(skr03_kontenplanList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="skr03_konto_ust_rueckfuehrung" entity="SKR03-Kontenplan">\n${JSON.stringify(skr03_kontenplanList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "fahrzeugbezeichnung": string | null, // Fahrzeugbezeichnung\n  "kennzeichen": string | null, // Kennzeichen\n  "leasingvertragsnummer": string | null, // Leasingvertragsnummer\n  "leasinggeber": string | null, // Display name from Lieferanten (see <available-records>)\n  "leasingbeginn": string | null, // YYYY-MM-DD\n  "leasingende": string | null, // YYYY-MM-DD\n  "leasingrate_brutto": number | null, // Leasingrate brutto (EUR)\n  "listenpreis_brutto": number | null, // Listenpreis brutto (EUR)\n  "private_nutzungsmethode": LookupValue | null, // Private Nutzungsmethode (select one key: "ein_prozent" | "fahrtenbuch") mapping: ein_prozent=1%-Regel, fahrtenbuch=Fahrtenbuch\n  "privatanteil_prozent": number | null, // Privatanteil % (nur bei Fahrtenbuch)\n  "skr03_konto_leasing": string | null, // Display name from SKR03-Kontenplan (see <available-records>)\n  "skr03_konto_ust_rueckfuehrung": string | null, // Display name from SKR03-Kontenplan (see <available-records>)\n  "nettoleasingrate": number | null, // Nettoleasingrate (EUR, berechnet)\n  "mwst_aus_leasingrate": number | null, // MwSt aus Leasingrate (EUR, berechnet)\n  "berechnungsgrundlage_ein_prozent": number | null, // Berechnungsgrundlage 1%-Regel (EUR, berechnet)\n  "mwst_anteil_rueckfuehrung": number | null, // MwSt-Anteil Rückführung (EUR, berechnet)\n  "mwst_rueckfuehrung_buchungsbetrag": number | null, // MwSt-Rückführung Buchungsbetrag (EUR, berechnet)\n}`;
      const raw = await extractFromInput<Record<string, unknown>>(schema, {
        dataUri: uri,
        userText: aiText.trim() || undefined,
        photoContext,
        intent: DIALOG_INTENT,
      });
      setFields(prev => {
        const merged = { ...prev } as Record<string, unknown>;
        function matchName(name: string, candidates: string[]): boolean {
          const n = name.toLowerCase().trim();
          return candidates.some(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
        }
        const applookupKeys = new Set<string>(["leasinggeber", "skr03_konto_leasing", "skr03_konto_ust_rueckfuehrung"]);
        for (const [k, v] of Object.entries(raw)) {
          if (applookupKeys.has(k)) continue;
          if (v != null) merged[k] = v;
        }
        const leasinggeberName = raw['leasinggeber'] as string | null;
        if (leasinggeberName) {
          const leasinggeberMatch = lieferantenList.find(r => matchName(leasinggeberName!, [String(r.fields.name ?? '')]));
          if (leasinggeberMatch) merged['leasinggeber'] = createRecordUrl(APP_IDS.LIEFERANTEN, leasinggeberMatch.record_id);
        }
        const skr03_konto_leasingName = raw['skr03_konto_leasing'] as string | null;
        if (skr03_konto_leasingName) {
          const skr03_konto_leasingMatch = skr03_kontenplanList.find(r => matchName(skr03_konto_leasingName!, [String(r.fields.kontonummer ?? '')]));
          if (skr03_konto_leasingMatch) merged['skr03_konto_leasing'] = createRecordUrl(APP_IDS.SKR03_KONTENPLAN, skr03_konto_leasingMatch.record_id);
        }
        const skr03_konto_ust_rueckfuehrungName = raw['skr03_konto_ust_rueckfuehrung'] as string | null;
        if (skr03_konto_ust_rueckfuehrungName) {
          const skr03_konto_ust_rueckfuehrungMatch = skr03_kontenplanList.find(r => matchName(skr03_konto_ust_rueckfuehrungName!, [String(r.fields.kontonummer ?? '')]));
          if (skr03_konto_ust_rueckfuehrungMatch) merged['skr03_konto_ust_rueckfuehrung'] = createRecordUrl(APP_IDS.SKR03_KONTENPLAN, skr03_konto_ust_rueckfuehrungMatch.record_id);
        }
        return merged as Partial<Leasingvertraege['fields']>;
      });
      setAiText('');
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      console.error('Scan fehlgeschlagen:', err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiExtract(f);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleAiExtract(file);
    }
  }, []);

  const DIALOG_INTENT = defaultValues ? 'Leasingverträge bearbeiten' : 'Leasingverträge hinzufügen';

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{DIALOG_INTENT}</DialogTitle>
        </DialogHeader>

        {enablePhotoScan && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div>
              <div className="flex items-center gap-1.5 font-medium">
                <IconSparkles className="h-4 w-4 text-primary" />
                KI-Assistent
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Versteht Fotos, Dokumente und Text und füllt alles für dich aus</p>
            </div>
            <div className="flex items-start gap-2 pl-0.5">
              <Checkbox
                id="ai-use-personal-info"
                checked={usePersonalInfo}
                onCheckedChange={(v) => setUsePersonalInfo(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                <Label htmlFor="ai-use-personal-info" className="text-xs font-normal text-muted-foreground cursor-pointer inline">
                  KI-Assistent darf zusätzlich Informationen zu meiner Person verwenden
                </Label>
                {' '}
                <button type="button" onClick={handleShowProfileInfo} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {profileLoading ? 'Lade...' : '(mehr Infos)'}
                </button>
              </span>
            </div>
            {showProfileInfo && (
              <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">Folgende Infos über dich können von der KI genutzt werden:</p>
                {profileData ? Object.values(profileData).map((v, i) => (
                  <span key={i}>{i > 0 && ", "}{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                )) : (
                  <span className="text-muted-foreground">Profil konnte nicht geladen werden</span>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              className={`
                relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${scanning
                  ? 'border-primary/40 bg-primary/5'
                  : scanSuccess
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20'
                    : dragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconLoader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">KI analysiert...</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Felder werden automatisch ausgefüllt</p>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <IconCircleCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Felder ausgefüllt!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Prüfe die Werte und passe sie ggf. an</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/8 flex items-center justify-center">
                    <IconPhotoPlus className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Foto oder Dokument hierher ziehen oder auswählen</p>
                  </div>
                </div>
              )}

              {preview && !scanning && (
                <div className="absolute top-2 right-2">
                  <div className="relative group">
                    <img src={preview} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted-foreground/80 text-white flex items-center justify-center"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                <IconCamera className="h-3.5 w-3.5 mr-1" />Kamera
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <IconUpload className="h-3.5 w-3.5 mr-1" />Foto wählen
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf,.pdf';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = 'image/*,application/pdf'; }, 100);
                  }
                }}>
                <IconFileText className="h-3.5 w-3.5 mr-1" />Dokument
              </Button>
            </div>

            <div className="relative">
              <Textarea
                placeholder="Text eingeben oder einfügen, z.B. Notizen, E-Mails, Beschreibungen..."
                value={aiText}
                onChange={e => {
                  setAiText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(Math.max(el.scrollHeight, 56), 96) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiText.trim() && !scanning) {
                    e.preventDefault();
                    handleAiExtract();
                  }
                }}
                disabled={scanning}
                rows={2}
                className="pr-12 resize-none text-sm overflow-y-auto"
              />
              <button
                type="button"
                className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                disabled={scanning}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setAiText(prev => prev ? prev + '\n' + text : text);
                  } catch {}
                }}
                title="Paste"
              >
                <IconClipboard className="h-4 w-4" />
              </button>
            </div>
            {aiText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                disabled={scanning}
                onClick={() => handleAiExtract()}
              >
                <IconSparkles className="h-3.5 w-3.5 mr-1.5" />Analysieren
              </Button>
            )}
            <div className="flex justify-center pt-1">
              <IconArrowBigDownLinesFilled className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fahrzeugbezeichnung">Fahrzeugbezeichnung</Label>
            <Input
              id="fahrzeugbezeichnung"
              value={fields.fahrzeugbezeichnung ?? ''}
              onChange={e => setFields(f => ({ ...f, fahrzeugbezeichnung: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kennzeichen">Kennzeichen</Label>
            <Input
              id="kennzeichen"
              value={fields.kennzeichen ?? ''}
              onChange={e => setFields(f => ({ ...f, kennzeichen: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="leasingvertragsnummer">Leasingvertragsnummer</Label>
            <Input
              id="leasingvertragsnummer"
              value={fields.leasingvertragsnummer ?? ''}
              onChange={e => setFields(f => ({ ...f, leasingvertragsnummer: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="leasinggeber">Leasinggeber</Label>
            <Select
              value={extractRecordId(fields.leasinggeber) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, leasinggeber: v === 'none' ? undefined : createRecordUrl(APP_IDS.LIEFERANTEN, v) }))}
            >
              <SelectTrigger id="leasinggeber"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {lieferantenList.map(r => (
                  <SelectItem key={r.record_id} value={r.record_id}>
                    {r.fields.name ?? r.record_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="leasingbeginn">Leasingbeginn</Label>
            <Input
              id="leasingbeginn"
              type="date"
              value={fields.leasingbeginn ?? ''}
              onChange={e => setFields(f => ({ ...f, leasingbeginn: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="leasingende">Leasingende</Label>
            <Input
              id="leasingende"
              type="date"
              value={fields.leasingende ?? ''}
              onChange={e => setFields(f => ({ ...f, leasingende: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="leasingrate_brutto">Leasingrate brutto (EUR)</Label>
            <Input
              id="leasingrate_brutto"
              type="number"
              value={fields.leasingrate_brutto ?? ''}
              onChange={e => setFields(f => ({ ...f, leasingrate_brutto: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="listenpreis_brutto">Listenpreis brutto (EUR)</Label>
            <Input
              id="listenpreis_brutto"
              type="number"
              value={fields.listenpreis_brutto ?? ''}
              onChange={e => setFields(f => ({ ...f, listenpreis_brutto: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="private_nutzungsmethode">Private Nutzungsmethode</Label>
            <Select
              value={lookupKey(fields.private_nutzungsmethode) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, private_nutzungsmethode: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="private_nutzungsmethode"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="ein_prozent">1%-Regel</SelectItem>
                <SelectItem value="fahrtenbuch">Fahrtenbuch</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="privatanteil_prozent">Privatanteil % (nur bei Fahrtenbuch)</Label>
            <Input
              id="privatanteil_prozent"
              type="number"
              value={fields.privatanteil_prozent ?? ''}
              onChange={e => setFields(f => ({ ...f, privatanteil_prozent: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skr03_konto_leasing">SKR03-Konto Leasing</Label>
            <Select
              value={extractRecordId(fields.skr03_konto_leasing) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, skr03_konto_leasing: v === 'none' ? undefined : createRecordUrl(APP_IDS.SKR03_KONTENPLAN, v) }))}
            >
              <SelectTrigger id="skr03_konto_leasing"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {skr03_kontenplanList.map(r => (
                  <SelectItem key={r.record_id} value={r.record_id}>
                    {r.fields.kontonummer ?? r.record_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="skr03_konto_ust_rueckfuehrung">SKR03-Konto USt-Rückführung</Label>
            <Select
              value={extractRecordId(fields.skr03_konto_ust_rueckfuehrung) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, skr03_konto_ust_rueckfuehrung: v === 'none' ? undefined : createRecordUrl(APP_IDS.SKR03_KONTENPLAN, v) }))}
            >
              <SelectTrigger id="skr03_konto_ust_rueckfuehrung"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {skr03_kontenplanList.map(r => (
                  <SelectItem key={r.record_id} value={r.record_id}>
                    {r.fields.kontonummer ?? r.record_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nettoleasingrate">Nettoleasingrate (EUR, berechnet)</Label>
            <Input
              id="nettoleasingrate"
              type="number"
              value={fields.nettoleasingrate ?? ''}
              onChange={e => setFields(f => ({ ...f, nettoleasingrate: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mwst_aus_leasingrate">MwSt aus Leasingrate (EUR, berechnet)</Label>
            <Input
              id="mwst_aus_leasingrate"
              type="number"
              value={fields.mwst_aus_leasingrate ?? ''}
              onChange={e => setFields(f => ({ ...f, mwst_aus_leasingrate: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="berechnungsgrundlage_ein_prozent">Berechnungsgrundlage 1%-Regel (EUR, berechnet)</Label>
            <Input
              id="berechnungsgrundlage_ein_prozent"
              type="number"
              value={fields.berechnungsgrundlage_ein_prozent ?? ''}
              onChange={e => setFields(f => ({ ...f, berechnungsgrundlage_ein_prozent: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mwst_anteil_rueckfuehrung">MwSt-Anteil Rückführung (EUR, berechnet)</Label>
            <Input
              id="mwst_anteil_rueckfuehrung"
              type="number"
              value={fields.mwst_anteil_rueckfuehrung ?? ''}
              onChange={e => setFields(f => ({ ...f, mwst_anteil_rueckfuehrung: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mwst_rueckfuehrung_buchungsbetrag">MwSt-Rückführung Buchungsbetrag (EUR, berechnet)</Label>
            <Input
              id="mwst_rueckfuehrung_buchungsbetrag"
              type="number"
              value={fields.mwst_rueckfuehrung_buchungsbetrag ?? ''}
              onChange={e => setFields(f => ({ ...f, mwst_rueckfuehrung_buchungsbetrag: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Speichern...' : defaultValues ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}