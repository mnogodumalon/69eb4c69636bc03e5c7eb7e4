// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Lieferanten {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    name?: string;
    strasse?: string;
    plz?: string;
    ort?: string;
    ust_idnr?: string;
    steuernummer?: string;
    standard_skr03_konto?: string; // applookup -> URL zu 'Skr03Kontenplan' Record
    bemerkung_lieferant?: string;
  };
}

export interface Steuerperioden {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    steuerjahr?: number;
    quartal?: LookupValue;
    von?: string; // Format: YYYY-MM-DD oder ISO String
    bis?: string; // Format: YYYY-MM-DD oder ISO String
    status_periode?: LookupValue;
  };
}

export interface Belegpositionen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    beleg_ref?: string; // applookup -> URL zu 'Belege' Record
    positionsnummer?: number;
    bezeichnung_pos?: string;
    menge?: number;
    einheit?: string;
    einzelpreis_netto?: number;
    nettobetrag_pos?: number;
    mwst_satz_pos?: LookupValue;
    mwst_betrag_pos?: number;
    bruttobetrag_pos?: number;
    skr03_konto_pos?: string; // applookup -> URL zu 'Skr03Kontenplan' Record
    bemerkung_pos?: string;
  };
}

export interface Skr03Kontenplan {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    kontonummer?: string;
    kontobezeichnung?: string;
    kontoklasse?: string;
  };
}

export interface Belege {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    beleg_datei?: string;
    belegnummer_lieferant?: string;
    lieferant_ref?: string; // applookup -> URL zu 'Lieferanten' Record
    steuerperiode_ref?: string; // applookup -> URL zu 'Steuerperioden' Record
    rechnungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    faelligkeitsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    buchungsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    upload_datum?: string; // Format: YYYY-MM-DD oder ISO String
    belegtyp?: LookupValue;
    dokumentklassifikation?: LookupValue;
    nettobetrag?: number;
    mwst_satz?: LookupValue;
    mwst_betrag?: number;
    bruttobetrag?: number;
    waehrung?: LookupValue;
    zahlungsart?: LookupValue;
    zahlungsstatus?: LookupValue;
    skr03_konto_beleg?: string; // applookup -> URL zu 'Skr03Kontenplan' Record
    bemerkungen_beleg?: string;
    ocr_status?: LookupValue;
    verarbeitungsstatus?: LookupValue;
    gesperrt?: boolean;
  };
}

export interface Leasingvertraege {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    fahrzeugbezeichnung?: string;
    kennzeichen?: string;
    leasingvertragsnummer?: string;
    leasinggeber?: string; // applookup -> URL zu 'Lieferanten' Record
    leasingbeginn?: string; // Format: YYYY-MM-DD oder ISO String
    leasingende?: string; // Format: YYYY-MM-DD oder ISO String
    leasingrate_brutto?: number;
    listenpreis_brutto?: number;
    private_nutzungsmethode?: LookupValue;
    privatanteil_prozent?: number;
    skr03_konto_leasing?: string; // applookup -> URL zu 'Skr03Kontenplan' Record
    skr03_konto_ust_rueckfuehrung?: string; // applookup -> URL zu 'Skr03Kontenplan' Record
    nettoleasingrate?: number;
    mwst_aus_leasingrate?: number;
    berechnungsgrundlage_ein_prozent?: number;
    mwst_anteil_rueckfuehrung?: number;
    mwst_rueckfuehrung_buchungsbetrag?: number;
  };
}

export const APP_IDS = {
  LIEFERANTEN: '69eb4c3e268be590a3c278b2',
  STEUERPERIODEN: '69eb4c3d238c00be8a7ea876',
  BELEGPOSITIONEN: '69eb4c41284fb47dd4dddbcf',
  SKR03_KONTENPLAN: '69eb4c352d3b185b8f5fd7fa',
  BELEGE: '69eb4c3ff1779a5204114e53',
  LEASINGVERTRAEGE: '69eb4c42bac37ace4aba4d62',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'steuerperioden': {
    quartal: [{ key: "q1", label: "Q1" }, { key: "q2", label: "Q2" }, { key: "q3", label: "Q3" }, { key: "q4", label: "Q4" }],
    status_periode: [{ key: "offen", label: "Offen" }, { key: "abgeschlossen", label: "Abgeschlossen" }, { key: "eingereicht", label: "Eingereicht" }],
  },
  'belegpositionen': {
    mwst_satz_pos: [{ key: "mwst_0", label: "0%" }, { key: "mwst_7", label: "7%" }, { key: "mwst_19", label: "19%" }],
  },
  'belege': {
    belegtyp: [{ key: "rechnung", label: "Rechnung" }, { key: "quittung", label: "Quittung" }, { key: "kassenbon", label: "Kassenbon" }, { key: "gutschrift", label: "Gutschrift" }, { key: "kontoauszug", label: "Kontoauszug" }, { key: "sonstiges", label: "Sonstiges" }],
    dokumentklassifikation: [{ key: "betriebsausgabe", label: "Betriebsausgabe" }, { key: "anlageversmoegen", label: "Anlagevermögen" }, { key: "umlaufvermoegen", label: "Umlaufvermögen" }, { key: "privatanteil", label: "Privatanteil" }, { key: "sonstiges_dok", label: "Sonstiges" }],
    mwst_satz: [{ key: "mwst_0", label: "0%" }, { key: "mwst_7", label: "7%" }, { key: "mwst_19", label: "19%" }],
    waehrung: [{ key: "eur", label: "EUR" }, { key: "usd", label: "USD" }, { key: "chf", label: "CHF" }, { key: "gbp", label: "GBP" }],
    zahlungsart: [{ key: "bar", label: "Bar" }, { key: "ueberweisung", label: "Überweisung" }, { key: "ec_karte", label: "EC-Karte" }, { key: "kreditkarte", label: "Kreditkarte" }, { key: "lastschrift", label: "Lastschrift" }, { key: "paypal", label: "PayPal" }],
    zahlungsstatus: [{ key: "offen", label: "Offen" }, { key: "bezahlt", label: "Bezahlt" }, { key: "storniert", label: "Storniert" }],
    ocr_status: [{ key: "ausstehend", label: "Ausstehend" }, { key: "verarbeitet", label: "Verarbeitet" }, { key: "fehlgeschlagen", label: "Fehlgeschlagen" }, { key: "manuell_korrigiert", label: "Manuell korrigiert" }],
    verarbeitungsstatus: [{ key: "pruefung_erforderlich", label: "Prüfung erforderlich" }, { key: "geprueft", label: "Geprüft" }, { key: "gebucht", label: "Gebucht" }, { key: "archiviert", label: "Archiviert" }, { key: "hochgeladen", label: "Hochgeladen" }, { key: "ocr_ausstehend", label: "OCR ausstehend" }],
  },
  'leasingvertraege': {
    private_nutzungsmethode: [{ key: "ein_prozent", label: "1%-Regel" }, { key: "fahrtenbuch", label: "Fahrtenbuch" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'lieferanten': {
    'name': 'string/text',
    'strasse': 'string/text',
    'plz': 'string/text',
    'ort': 'string/text',
    'ust_idnr': 'string/text',
    'steuernummer': 'string/text',
    'standard_skr03_konto': 'applookup/select',
    'bemerkung_lieferant': 'string/textarea',
  },
  'steuerperioden': {
    'bezeichnung': 'string/text',
    'steuerjahr': 'number',
    'quartal': 'lookup/select',
    'von': 'date/date',
    'bis': 'date/date',
    'status_periode': 'lookup/select',
  },
  'belegpositionen': {
    'beleg_ref': 'applookup/select',
    'positionsnummer': 'number',
    'bezeichnung_pos': 'string/text',
    'menge': 'number',
    'einheit': 'string/text',
    'einzelpreis_netto': 'number',
    'nettobetrag_pos': 'number',
    'mwst_satz_pos': 'lookup/radio',
    'mwst_betrag_pos': 'number',
    'bruttobetrag_pos': 'number',
    'skr03_konto_pos': 'applookup/select',
    'bemerkung_pos': 'string/text',
  },
  'skr03_kontenplan': {
    'kontonummer': 'string/text',
    'kontobezeichnung': 'string/text',
    'kontoklasse': 'string/text',
  },
  'belege': {
    'beleg_datei': 'file',
    'belegnummer_lieferant': 'string/text',
    'lieferant_ref': 'applookup/select',
    'steuerperiode_ref': 'applookup/select',
    'rechnungsdatum': 'date/date',
    'faelligkeitsdatum': 'date/date',
    'buchungsdatum': 'date/date',
    'upload_datum': 'date/date',
    'belegtyp': 'lookup/select',
    'dokumentklassifikation': 'lookup/select',
    'nettobetrag': 'number',
    'mwst_satz': 'lookup/radio',
    'mwst_betrag': 'number',
    'bruttobetrag': 'number',
    'waehrung': 'lookup/select',
    'zahlungsart': 'lookup/select',
    'zahlungsstatus': 'lookup/select',
    'skr03_konto_beleg': 'applookup/select',
    'bemerkungen_beleg': 'string/textarea',
    'ocr_status': 'lookup/select',
    'verarbeitungsstatus': 'lookup/select',
    'gesperrt': 'bool',
  },
  'leasingvertraege': {
    'fahrzeugbezeichnung': 'string/text',
    'kennzeichen': 'string/text',
    'leasingvertragsnummer': 'string/text',
    'leasinggeber': 'applookup/select',
    'leasingbeginn': 'date/date',
    'leasingende': 'date/date',
    'leasingrate_brutto': 'number',
    'listenpreis_brutto': 'number',
    'private_nutzungsmethode': 'lookup/radio',
    'privatanteil_prozent': 'number',
    'skr03_konto_leasing': 'applookup/select',
    'skr03_konto_ust_rueckfuehrung': 'applookup/select',
    'nettoleasingrate': 'number',
    'mwst_aus_leasingrate': 'number',
    'berechnungsgrundlage_ein_prozent': 'number',
    'mwst_anteil_rueckfuehrung': 'number',
    'mwst_rueckfuehrung_buchungsbetrag': 'number',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateLieferanten = StripLookup<Lieferanten['fields']>;
export type CreateSteuerperioden = StripLookup<Steuerperioden['fields']>;
export type CreateBelegpositionen = StripLookup<Belegpositionen['fields']>;
export type CreateSkr03Kontenplan = StripLookup<Skr03Kontenplan['fields']>;
export type CreateBelege = StripLookup<Belege['fields']>;
export type CreateLeasingvertraege = StripLookup<Leasingvertraege['fields']>;