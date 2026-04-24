import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Skr03Kontenplan, Steuerperioden, Lieferanten, Belege, Belegpositionen, Leasingvertraege } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [skr03Kontenplan, setSkr03Kontenplan] = useState<Skr03Kontenplan[]>([]);
  const [steuerperioden, setSteuerperioden] = useState<Steuerperioden[]>([]);
  const [lieferanten, setLieferanten] = useState<Lieferanten[]>([]);
  const [belege, setBelege] = useState<Belege[]>([]);
  const [belegpositionen, setBelegpositionen] = useState<Belegpositionen[]>([]);
  const [leasingvertraege, setLeasingvertraege] = useState<Leasingvertraege[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [skr03KontenplanData, steuerperiodenData, lieferantenData, belegeData, belegpositionenData, leasingvertraegeData] = await Promise.all([
        LivingAppsService.getSkr03Kontenplan(),
        LivingAppsService.getSteuerperioden(),
        LivingAppsService.getLieferanten(),
        LivingAppsService.getBelege(),
        LivingAppsService.getBelegpositionen(),
        LivingAppsService.getLeasingvertraege(),
      ]);
      setSkr03Kontenplan(skr03KontenplanData);
      setSteuerperioden(steuerperiodenData);
      setLieferanten(lieferantenData);
      setBelege(belegeData);
      setBelegpositionen(belegpositionenData);
      setLeasingvertraege(leasingvertraegeData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [skr03KontenplanData, steuerperiodenData, lieferantenData, belegeData, belegpositionenData, leasingvertraegeData] = await Promise.all([
          LivingAppsService.getSkr03Kontenplan(),
          LivingAppsService.getSteuerperioden(),
          LivingAppsService.getLieferanten(),
          LivingAppsService.getBelege(),
          LivingAppsService.getBelegpositionen(),
          LivingAppsService.getLeasingvertraege(),
        ]);
        setSkr03Kontenplan(skr03KontenplanData);
        setSteuerperioden(steuerperiodenData);
        setLieferanten(lieferantenData);
        setBelege(belegeData);
        setBelegpositionen(belegpositionenData);
        setLeasingvertraege(leasingvertraegeData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const skr03KontenplanMap = useMemo(() => {
    const m = new Map<string, Skr03Kontenplan>();
    skr03Kontenplan.forEach(r => m.set(r.record_id, r));
    return m;
  }, [skr03Kontenplan]);

  const steuerperiodenMap = useMemo(() => {
    const m = new Map<string, Steuerperioden>();
    steuerperioden.forEach(r => m.set(r.record_id, r));
    return m;
  }, [steuerperioden]);

  const lieferantenMap = useMemo(() => {
    const m = new Map<string, Lieferanten>();
    lieferanten.forEach(r => m.set(r.record_id, r));
    return m;
  }, [lieferanten]);

  const belegeMap = useMemo(() => {
    const m = new Map<string, Belege>();
    belege.forEach(r => m.set(r.record_id, r));
    return m;
  }, [belege]);

  return { skr03Kontenplan, setSkr03Kontenplan, steuerperioden, setSteuerperioden, lieferanten, setLieferanten, belege, setBelege, belegpositionen, setBelegpositionen, leasingvertraege, setLeasingvertraege, loading, error, fetchAll, skr03KontenplanMap, steuerperiodenMap, lieferantenMap, belegeMap };
}