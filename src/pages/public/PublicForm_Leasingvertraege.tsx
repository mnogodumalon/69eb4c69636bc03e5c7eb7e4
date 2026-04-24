import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
const APP_ID = '69eb4c42bac37ace4aba4d62';
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

export default function PublicFormLeasingvertraege() {
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
          <h1 className="text-2xl font-bold text-foreground">Leasingverträge — Formular</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6 shadow-md">
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
