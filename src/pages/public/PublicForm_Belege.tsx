import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { lookupKey } from '@/lib/formatters';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'altcha-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        challengeurl?: string;
        auto?: string;
        hidelogo?: boolean;
        hidefooter?: boolean;
      }, HTMLElement>;
    }
  }
}

// Empty PROXY_BASE → relative URLs (dashboard and form-proxy share the domain).
const PROXY_BASE = '';
const APP_ID = '69eb4c3ff1779a5204114e53';
const SUBMIT_PATH = `/rest/apps/${APP_ID}/records`;
const ALTCHA_SCRIPT_SRC = 'https://cdn.jsdelivr.net/npm/altcha/dist/altcha.min.js';

async function submitPublicForm(fields: Record<string, unknown>, captchaToken: string) {
  const res = await fetch(`${PROXY_BASE}/api${SUBMIT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Captcha-Token': captchaToken,
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || 'Submission failed');
  }
  return res.json();
}


function cleanFields(fields: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (typeof value === 'object' && !Array.isArray(value) && 'key' in (value as any)) {
      cleaned[key] = (value as any).key;
    } else if (Array.isArray(value)) {
      cleaned[key] = value.map(item =>
        typeof item === 'object' && item !== null && 'key' in item ? item.key : item
      );
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export default function PublicFormBelege() {
  const [fields, setFields] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captchaRef = useRef<HTMLElement | null>(null);

  // Load the ALTCHA web component script once per page.
  useEffect(() => {
    if (document.querySelector(`script[src="${ALTCHA_SCRIPT_SRC}"]`)) return;
    const s = document.createElement('script');
    s.src = ALTCHA_SCRIPT_SRC;
    s.defer = true;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return;
    const params = new URLSearchParams(hash.slice(qIdx + 1));
    const prefill: Record<string, any> = {};
    params.forEach((value, key) => { prefill[key] = value; });
    if (Object.keys(prefill).length) setFields(prev => ({ ...prefill, ...prev }));
  }, []);

  function readCaptchaToken(): string | null {
    const el = captchaRef.current as any;
    if (!el) return null;
    return el.value || el.getAttribute('value') || null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = readCaptchaToken();
    if (!token) {
      setError('Bitte warte auf die Spam-Prüfung und versuche es erneut.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitPublicForm(cleanFields(fields), token);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Etwas ist schiefgelaufen. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Vielen Dank!</h2>
          <p className="text-muted-foreground">Deine Eingabe wurde erfolgreich übermittelt.</p>
          <Button variant="outline" className="mt-4" onClick={() => { setSubmitted(false); setFields({}); }}>
            Weitere Eingabe
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Belege — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
          <div className="space-y-2">
            <Label htmlFor="belegnummer_lieferant">Belegnummer Lieferant</Label>
            <Input
              id="belegnummer_lieferant"
              value={fields.belegnummer_lieferant ?? ''}
              onChange={e => setFields(f => ({ ...f, belegnummer_lieferant: e.target.value }))}
            />
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

          <altcha-widget
            ref={captchaRef as any}
            challengeurl={`${PROXY_BASE}/api/_challenge?path=${encodeURIComponent(SUBMIT_PATH)}`}
            auto="onsubmit"
            hidefooter
          />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Wird gesendet...' : 'Absenden'}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Powered by Klar
        </p>
      </div>
    </div>
  );
}
