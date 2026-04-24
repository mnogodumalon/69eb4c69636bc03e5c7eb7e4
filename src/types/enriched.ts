import type { Belege, Belegpositionen, Leasingvertraege, Lieferanten } from './app';

export type EnrichedLieferanten = Lieferanten & {
  standard_skr03_kontoName: string;
};

export type EnrichedBelegpositionen = Belegpositionen & {
  beleg_refName: string;
  skr03_konto_posName: string;
};

export type EnrichedBelege = Belege & {
  lieferant_refName: string;
  steuerperiode_refName: string;
  skr03_konto_belegName: string;
};

export type EnrichedLeasingvertraege = Leasingvertraege & {
  leasinggeberName: string;
  skr03_konto_leasingName: string;
  skr03_konto_ust_rueckfuehrungName: string;
};
