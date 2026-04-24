import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Lieferanten, Steuerperioden, Belegpositionen, Skr03Kontenplan, Belege, Leasingvertraege } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [lieferanten, setLieferanten] = useState<Lieferanten[]>([]);
  const [steuerperioden, setSteuerperioden] = useState<Steuerperioden[]>([]);
  const [belegpositionen, setBelegpositionen] = useState<Belegpositionen[]>([]);
  const [skr03Kontenplan, setSkr03Kontenplan] = useState<Skr03Kontenplan[]>([]);
  const [belege, setBelege] = useState<Belege[]>([]);
  const [leasingvertraege, setLeasingvertraege] = useState<Leasingvertraege[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [lieferantenData, steuerperiodenData, belegpositionenData, skr03KontenplanData, belegeData, leasingvertraegeData] = await Promise.all([
        LivingAppsService.getLieferanten(),
        LivingAppsService.getSteuerperioden(),
        LivingAppsService.getBelegpositionen(),
        LivingAppsService.getSkr03Kontenplan(),
        LivingAppsService.getBelege(),
        LivingAppsService.getLeasingvertraege(),
      ]);
      setLieferanten(lieferantenData);
      setSteuerperioden(steuerperiodenData);
      setBelegpositionen(belegpositionenData);
      setSkr03Kontenplan(skr03KontenplanData);
      setBelege(belegeData);
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
        const [lieferantenData, steuerperiodenData, belegpositionenData, skr03KontenplanData, belegeData, leasingvertraegeData] = await Promise.all([
          LivingAppsService.getLieferanten(),
          LivingAppsService.getSteuerperioden(),
          LivingAppsService.getBelegpositionen(),
          LivingAppsService.getSkr03Kontenplan(),
          LivingAppsService.getBelege(),
          LivingAppsService.getLeasingvertraege(),
        ]);
        setLieferanten(lieferantenData);
        setSteuerperioden(steuerperiodenData);
        setBelegpositionen(belegpositionenData);
        setSkr03Kontenplan(skr03KontenplanData);
        setBelege(belegeData);
        setLeasingvertraege(leasingvertraegeData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const lieferantenMap = useMemo(() => {
    const m = new Map<string, Lieferanten>();
    lieferanten.forEach(r => m.set(r.record_id, r));
    return m;
  }, [lieferanten]);

  const steuerperiodenMap = useMemo(() => {
    const m = new Map<string, Steuerperioden>();
    steuerperioden.forEach(r => m.set(r.record_id, r));
    return m;
  }, [steuerperioden]);

  const skr03KontenplanMap = useMemo(() => {
    const m = new Map<string, Skr03Kontenplan>();
    skr03Kontenplan.forEach(r => m.set(r.record_id, r));
    return m;
  }, [skr03Kontenplan]);

  const belegeMap = useMemo(() => {
    const m = new Map<string, Belege>();
    belege.forEach(r => m.set(r.record_id, r));
    return m;
  }, [belege]);

  return { lieferanten, setLieferanten, steuerperioden, setSteuerperioden, belegpositionen, setBelegpositionen, skr03Kontenplan, setSkr03Kontenplan, belege, setBelege, leasingvertraege, setLeasingvertraege, loading, error, fetchAll, lieferantenMap, steuerperiodenMap, skr03KontenplanMap, belegeMap };
}