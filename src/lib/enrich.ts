import type { EnrichedBelege, EnrichedBelegpositionen, EnrichedLeasingvertraege, EnrichedLieferanten } from '@/types/enriched';
import type { Belege, Belegpositionen, Leasingvertraege, Lieferanten, Skr03Kontenplan, Steuerperioden } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface LieferantenMaps {
  skr03KontenplanMap: Map<string, Skr03Kontenplan>;
}

export function enrichLieferanten(
  lieferanten: Lieferanten[],
  maps: LieferantenMaps
): EnrichedLieferanten[] {
  return lieferanten.map(r => ({
    ...r,
    standard_skr03_kontoName: resolveDisplay(r.fields.standard_skr03_konto, maps.skr03KontenplanMap, 'kontonummer'),
  }));
}

interface BelegeMaps {
  lieferantenMap: Map<string, Lieferanten>;
  steuerperiodenMap: Map<string, Steuerperioden>;
  skr03KontenplanMap: Map<string, Skr03Kontenplan>;
}

export function enrichBelege(
  belege: Belege[],
  maps: BelegeMaps
): EnrichedBelege[] {
  return belege.map(r => ({
    ...r,
    lieferant_refName: resolveDisplay(r.fields.lieferant_ref, maps.lieferantenMap, 'name'),
    steuerperiode_refName: resolveDisplay(r.fields.steuerperiode_ref, maps.steuerperiodenMap, 'bezeichnung'),
    skr03_konto_belegName: resolveDisplay(r.fields.skr03_konto_beleg, maps.skr03KontenplanMap, 'kontonummer'),
  }));
}

interface BelegpositionenMaps {
  belegeMap: Map<string, Belege>;
  skr03KontenplanMap: Map<string, Skr03Kontenplan>;
}

export function enrichBelegpositionen(
  belegpositionen: Belegpositionen[],
  maps: BelegpositionenMaps
): EnrichedBelegpositionen[] {
  return belegpositionen.map(r => ({
    ...r,
    beleg_refName: resolveDisplay(r.fields.beleg_ref, maps.belegeMap, 'belegnummer_lieferant'),
    skr03_konto_posName: resolveDisplay(r.fields.skr03_konto_pos, maps.skr03KontenplanMap, 'kontonummer'),
  }));
}

interface LeasingvertraegeMaps {
  lieferantenMap: Map<string, Lieferanten>;
  skr03KontenplanMap: Map<string, Skr03Kontenplan>;
}

export function enrichLeasingvertraege(
  leasingvertraege: Leasingvertraege[],
  maps: LeasingvertraegeMaps
): EnrichedLeasingvertraege[] {
  return leasingvertraege.map(r => ({
    ...r,
    leasinggeberName: resolveDisplay(r.fields.leasinggeber, maps.lieferantenMap, 'name'),
    skr03_konto_leasingName: resolveDisplay(r.fields.skr03_konto_leasing, maps.skr03KontenplanMap, 'kontonummer'),
    skr03_konto_ust_rueckfuehrungName: resolveDisplay(r.fields.skr03_konto_ust_rueckfuehrung, maps.skr03KontenplanMap, 'kontonummer'),
  }));
}
