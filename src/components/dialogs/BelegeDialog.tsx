import { useState, useEffect, useRef, useCallback } from 'react';
import type { Belege, Lieferanten, Steuerperioden, Skr03Kontenplan } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, uploadFile, getUserProfile } from '@/services/livingAppsService';
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
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode, dataUriToBlob } from '@/lib/ai';
import { lookupKey } from '@/lib/formatters';

interface BelegeDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Belege['fields']) => Promise<void>;
  defaultValues?: Belege['fields'];
  lieferantenList: Lieferanten[];
  steuerperiodenList: Steuerperioden[];
  skr03_kontenplanList: Skr03Kontenplan[];
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

export function BelegeDialog({ open, onClose, onSubmit, defaultValues, lieferantenList, steuerperiodenList, skr03_kontenplanList, enablePhotoScan = true, enablePhotoLocation = true }: BelegeDialogProps) {
  const [fields, setFields] = useState<Partial<Belege['fields']>>({});
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
      const clean = cleanFieldsForApi({ ...fields }, 'belege');
      await onSubmit(clean as Belege['fields']);
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
      contextParts.push(`<available-records field="lieferant_ref" entity="Lieferanten">\n${JSON.stringify(lieferantenList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="steuerperiode_ref" entity="Steuerperioden">\n${JSON.stringify(steuerperiodenList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      contextParts.push(`<available-records field="skr03_konto_beleg" entity="SKR03-Kontenplan">\n${JSON.stringify(skr03_kontenplanList.map(r => ({ record_id: r.record_id, ...r.fields })), null, 2)}\n</available-records>`);
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "belegnummer_lieferant": string | null, // Belegnummer Lieferant\n  "lieferant_ref": string | null, // Display name from Lieferanten (see <available-records>)\n  "steuerperiode_ref": string | null, // Display name from Steuerperioden (see <available-records>)\n  "rechnungsdatum": string | null, // YYYY-MM-DD\n  "faelligkeitsdatum": string | null, // YYYY-MM-DD\n  "buchungsdatum": string | null, // YYYY-MM-DD\n  "upload_datum": string | null, // YYYY-MM-DD\n  "belegtyp": LookupValue | null, // Belegtyp (select one key: "rechnung" | "quittung" | "kassenbon" | "gutschrift" | "kontoauszug" | "sonstiges") mapping: rechnung=Rechnung, quittung=Quittung, kassenbon=Kassenbon, gutschrift=Gutschrift, kontoauszug=Kontoauszug, sonstiges=Sonstiges\n  "dokumentklassifikation": LookupValue | null, // Dokumentklassifikation (select one key: "betriebsausgabe" | "anlageversmoegen" | "umlaufvermoegen" | "privatanteil" | "sonstiges_dok") mapping: betriebsausgabe=Betriebsausgabe, anlageversmoegen=Anlagevermögen, umlaufvermoegen=Umlaufvermögen, privatanteil=Privatanteil, sonstiges_dok=Sonstiges\n  "nettobetrag": number | null, // Nettobetrag (EUR)\n  "mwst_satz": LookupValue | null, // MwSt-Satz (select one key: "mwst_0" | "mwst_7" | "mwst_19") mapping: mwst_0=0%, mwst_7=7%, mwst_19=19%\n  "mwst_betrag": number | null, // MwSt-Betrag (EUR, berechnet)\n  "bruttobetrag": number | null, // Bruttobetrag (EUR, berechnet)\n  "waehrung": LookupValue | null, // Währung (select one key: "eur" | "usd" | "chf" | "gbp") mapping: eur=EUR, usd=USD, chf=CHF, gbp=GBP\n  "zahlungsart": LookupValue | null, // Zahlungsart (select one key: "bar" | "ueberweisung" | "ec_karte" | "kreditkarte" | "lastschrift" | "paypal") mapping: bar=Bar, ueberweisung=Überweisung, ec_karte=EC-Karte, kreditkarte=Kreditkarte, lastschrift=Lastschrift, paypal=PayPal\n  "zahlungsstatus": LookupValue | null, // Zahlungsstatus (select one key: "offen" | "bezahlt" | "storniert") mapping: offen=Offen, bezahlt=Bezahlt, storniert=Storniert\n  "skr03_konto_beleg": string | null, // Display name from SKR03-Kontenplan (see <available-records>)\n  "bemerkungen_beleg": string | null, // Bemerkungen\n  "ocr_status": LookupValue | null, // OCR-Status (select one key: "ausstehend" | "verarbeitet" | "fehlgeschlagen" | "manuell_korrigiert") mapping: ausstehend=Ausstehend, verarbeitet=Verarbeitet, fehlgeschlagen=Fehlgeschlagen, manuell_korrigiert=Manuell korrigiert\n  "verarbeitungsstatus": LookupValue | null, // Verarbeitungsstatus (select one key: "pruefung_erforderlich" | "geprueft" | "gebucht" | "archiviert" | "hochgeladen" | "ocr_ausstehend") mapping: pruefung_erforderlich=Prüfung erforderlich, geprueft=Geprüft, gebucht=Gebucht, archiviert=Archiviert, hochgeladen=Hochgeladen, ocr_ausstehend=OCR ausstehend\n  "gesperrt": boolean | null, // Gesperrt (automatisch bei Status 'Gebucht')\n}`;
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
        const applookupKeys = new Set<string>(["lieferant_ref", "steuerperiode_ref", "skr03_konto_beleg"]);
        for (const [k, v] of Object.entries(raw)) {
          if (applookupKeys.has(k)) continue;
          if (v != null) merged[k] = v;
        }
        const lieferant_refName = raw['lieferant_ref'] as string | null;
        if (lieferant_refName) {
          const lieferant_refMatch = lieferantenList.find(r => matchName(lieferant_refName!, [String(r.fields.name ?? '')]));
          if (lieferant_refMatch) merged['lieferant_ref'] = createRecordUrl(APP_IDS.LIEFERANTEN, lieferant_refMatch.record_id);
        }
        const steuerperiode_refName = raw['steuerperiode_ref'] as string | null;
        if (steuerperiode_refName) {
          const steuerperiode_refMatch = steuerperiodenList.find(r => matchName(steuerperiode_refName!, [String(r.fields.bezeichnung ?? '')]));
          if (steuerperiode_refMatch) merged['steuerperiode_ref'] = createRecordUrl(APP_IDS.STEUERPERIODEN, steuerperiode_refMatch.record_id);
        }
        const skr03_konto_belegName = raw['skr03_konto_beleg'] as string | null;
        if (skr03_konto_belegName) {
          const skr03_konto_belegMatch = skr03_kontenplanList.find(r => matchName(skr03_konto_belegName!, [String(r.fields.kontonummer ?? '')]));
          if (skr03_konto_belegMatch) merged['skr03_konto_beleg'] = createRecordUrl(APP_IDS.SKR03_KONTENPLAN, skr03_konto_belegMatch.record_id);
        }
        return merged as Partial<Belege['fields']>;
      });
      // Upload scanned file to file fields
      if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
        try {
          const blob = dataUriToBlob(uri!);
          const fileUrl = await uploadFile(blob, file.name);
          setFields(prev => ({ ...prev, beleg_datei: fileUrl }));
        } catch (uploadErr) {
          console.error('File upload failed:', uploadErr);
        }
      }
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

  const DIALOG_INTENT = defaultValues ? 'Belege bearbeiten' : 'Belege hinzufügen';

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
            <Label htmlFor="beleg_datei">Beleg-Datei (PDF, JPG, PNG)</Label>
            {fields.beleg_datei ? (
              <div className="flex items-center gap-3 rounded-lg border p-2">
                <div className="relative h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <IconFileText size={20} className="text-muted-foreground" />
                  </div>
                  <img
                    src={fields.beleg_datei}
                    alt=""
                    className="relative h-full w-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate text-foreground">{fields.beleg_datei.split("/").pop()}</p>
                  <div className="flex gap-2 mt-1">
                    <label
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      Ändern
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const fileUrl = await uploadFile(file, file.name);
                            setFields(f => ({ ...f, beleg_datei: fileUrl }));
                          } catch (err) { console.error('Upload failed:', err); }
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => setFields(f => ({ ...f, beleg_datei: undefined }))}
                    >
                      Entfernen
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                <IconUpload size={20} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Datei hochladen</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const fileUrl = await uploadFile(file, file.name);
                      setFields(f => ({ ...f, beleg_datei: fileUrl }));
                    } catch (err) { console.error('Upload failed:', err); }
                  }}
                />
              </label>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="belegnummer_lieferant">Belegnummer Lieferant</Label>
            <Input
              id="belegnummer_lieferant"
              value={fields.belegnummer_lieferant ?? ''}
              onChange={e => setFields(f => ({ ...f, belegnummer_lieferant: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lieferant_ref">Lieferant</Label>
            <Select
              value={extractRecordId(fields.lieferant_ref) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, lieferant_ref: v === 'none' ? undefined : createRecordUrl(APP_IDS.LIEFERANTEN, v) }))}
            >
              <SelectTrigger id="lieferant_ref"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
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
            <Label htmlFor="steuerperiode_ref">Steuerperiode</Label>
            <Select
              value={extractRecordId(fields.steuerperiode_ref) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, steuerperiode_ref: v === 'none' ? undefined : createRecordUrl(APP_IDS.STEUERPERIODEN, v) }))}
            >
              <SelectTrigger id="steuerperiode_ref"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {steuerperiodenList.map(r => (
                  <SelectItem key={r.record_id} value={r.record_id}>
                    {r.fields.bezeichnung ?? r.record_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rechnungsdatum">Rechnungsdatum</Label>
            <Input
              id="rechnungsdatum"
              type="date"
              value={fields.rechnungsdatum ?? ''}
              onChange={e => setFields(f => ({ ...f, rechnungsdatum: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="faelligkeitsdatum">Fälligkeitsdatum</Label>
            <Input
              id="faelligkeitsdatum"
              type="date"
              value={fields.faelligkeitsdatum ?? ''}
              onChange={e => setFields(f => ({ ...f, faelligkeitsdatum: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="buchungsdatum">Buchungsdatum</Label>
            <Input
              id="buchungsdatum"
              type="date"
              value={fields.buchungsdatum ?? ''}
              onChange={e => setFields(f => ({ ...f, buchungsdatum: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="upload_datum">Upload-Datum (automatisch)</Label>
            <Input
              id="upload_datum"
              type="date"
              value={fields.upload_datum ?? ''}
              onChange={e => setFields(f => ({ ...f, upload_datum: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="belegtyp">Belegtyp</Label>
            <Select
              value={lookupKey(fields.belegtyp) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, belegtyp: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="belegtyp"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="rechnung">Rechnung</SelectItem>
                <SelectItem value="quittung">Quittung</SelectItem>
                <SelectItem value="kassenbon">Kassenbon</SelectItem>
                <SelectItem value="gutschrift">Gutschrift</SelectItem>
                <SelectItem value="kontoauszug">Kontoauszug</SelectItem>
                <SelectItem value="sonstiges">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dokumentklassifikation">Dokumentklassifikation</Label>
            <Select
              value={lookupKey(fields.dokumentklassifikation) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, dokumentklassifikation: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="dokumentklassifikation"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="betriebsausgabe">Betriebsausgabe</SelectItem>
                <SelectItem value="anlageversmoegen">Anlagevermögen</SelectItem>
                <SelectItem value="umlaufvermoegen">Umlaufvermögen</SelectItem>
                <SelectItem value="privatanteil">Privatanteil</SelectItem>
                <SelectItem value="sonstiges_dok">Sonstiges</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nettobetrag">Nettobetrag (EUR)</Label>
            <Input
              id="nettobetrag"
              type="number"
              value={fields.nettobetrag ?? ''}
              onChange={e => setFields(f => ({ ...f, nettobetrag: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mwst_satz">MwSt-Satz</Label>
            <Select
              value={lookupKey(fields.mwst_satz) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, mwst_satz: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="mwst_satz"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="mwst_0">0%</SelectItem>
                <SelectItem value="mwst_7">7%</SelectItem>
                <SelectItem value="mwst_19">19%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mwst_betrag">MwSt-Betrag (EUR, berechnet)</Label>
            <Input
              id="mwst_betrag"
              type="number"
              value={fields.mwst_betrag ?? ''}
              onChange={e => setFields(f => ({ ...f, mwst_betrag: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bruttobetrag">Bruttobetrag (EUR, berechnet)</Label>
            <Input
              id="bruttobetrag"
              type="number"
              value={fields.bruttobetrag ?? ''}
              onChange={e => setFields(f => ({ ...f, bruttobetrag: e.target.value ? Number(e.target.value) : undefined }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="waehrung">Währung</Label>
            <Select
              value={lookupKey(fields.waehrung) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, waehrung: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="waehrung"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="eur">EUR</SelectItem>
                <SelectItem value="usd">USD</SelectItem>
                <SelectItem value="chf">CHF</SelectItem>
                <SelectItem value="gbp">GBP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="zahlungsart">Zahlungsart</Label>
            <Select
              value={lookupKey(fields.zahlungsart) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, zahlungsart: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="zahlungsart"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="bar">Bar</SelectItem>
                <SelectItem value="ueberweisung">Überweisung</SelectItem>
                <SelectItem value="ec_karte">EC-Karte</SelectItem>
                <SelectItem value="kreditkarte">Kreditkarte</SelectItem>
                <SelectItem value="lastschrift">Lastschrift</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="zahlungsstatus">Zahlungsstatus</Label>
            <Select
              value={lookupKey(fields.zahlungsstatus) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, zahlungsstatus: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="zahlungsstatus"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="offen">Offen</SelectItem>
                <SelectItem value="bezahlt">Bezahlt</SelectItem>
                <SelectItem value="storniert">Storniert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="skr03_konto_beleg">SKR03-Konto Beleg</Label>
            <Select
              value={extractRecordId(fields.skr03_konto_beleg) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, skr03_konto_beleg: v === 'none' ? undefined : createRecordUrl(APP_IDS.SKR03_KONTENPLAN, v) }))}
            >
              <SelectTrigger id="skr03_konto_beleg"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
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
            <Label htmlFor="bemerkungen_beleg">Bemerkungen</Label>
            <Textarea
              id="bemerkungen_beleg"
              value={fields.bemerkungen_beleg ?? ''}
              onChange={e => setFields(f => ({ ...f, bemerkungen_beleg: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ocr_status">OCR-Status</Label>
            <Select
              value={lookupKey(fields.ocr_status) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, ocr_status: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="ocr_status"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="ausstehend">Ausstehend</SelectItem>
                <SelectItem value="verarbeitet">Verarbeitet</SelectItem>
                <SelectItem value="fehlgeschlagen">Fehlgeschlagen</SelectItem>
                <SelectItem value="manuell_korrigiert">Manuell korrigiert</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="verarbeitungsstatus">Verarbeitungsstatus</Label>
            <Select
              value={lookupKey(fields.verarbeitungsstatus) ?? 'none'}
              onValueChange={v => setFields(f => ({ ...f, verarbeitungsstatus: v === 'none' ? undefined : v as any }))}
            >
              <SelectTrigger id="verarbeitungsstatus"><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                <SelectItem value="pruefung_erforderlich">Prüfung erforderlich</SelectItem>
                <SelectItem value="geprueft">Geprüft</SelectItem>
                <SelectItem value="gebucht">Gebucht</SelectItem>
                <SelectItem value="archiviert">Archiviert</SelectItem>
                <SelectItem value="hochgeladen">Hochgeladen</SelectItem>
                <SelectItem value="ocr_ausstehend">OCR ausstehend</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="gesperrt">Gesperrt (automatisch bei Status 'Gebucht')</Label>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="gesperrt"
                checked={!!fields.gesperrt}
                onCheckedChange={(v) => setFields(f => ({ ...f, gesperrt: !!v }))}
              />
              <Label htmlFor="gesperrt" className="font-normal">Gesperrt (automatisch bei Status 'Gebucht')</Label>
            </div>
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