// AUTOMATICALLY GENERATED SERVICE
import { APP_IDS, LOOKUP_OPTIONS, FIELD_TYPES } from '@/types/app';
import type { Skr03Kontenplan, Steuerperioden, Lieferanten, Belege, Belegpositionen, Leasingvertraege, CreateSkr03Kontenplan, CreateSteuerperioden, CreateLieferanten, CreateBelege, CreateBelegpositionen, CreateLeasingvertraege } from '@/types/app';

// Base Configuration
const API_BASE_URL = 'https://my.living-apps.de/rest';

// --- HELPER FUNCTIONS ---
export function extractRecordId(url: unknown): string | null {
  if (!url) return null;
  if (typeof url !== 'string') return null;
  const match = url.match(/([a-f0-9]{24})$/i);
  return match ? match[1] : null;
}

export function createRecordUrl(appId: string, recordId: string): string {
  return `https://my.living-apps.de/rest/apps/${appId}/records/${recordId}`;
}

export class LivingAppsApiError extends Error {
  status: number;
  type?: string;
  control_identifier?: string;
  control_type?: string;
  field_type?: string;
  detail?: string;
  constructor(message: string, status: number, raw?: Record<string, unknown>) {
    super(message);
    this.name = 'LivingAppsApiError';
    this.status = status;
    if (raw) {
      this.type = typeof raw.type === 'string' ? raw.type : undefined;
      this.control_identifier = typeof raw.control_identifier === 'string' ? raw.control_identifier : undefined;
      this.control_type = typeof raw.control_type === 'string' ? raw.control_type : undefined;
      this.field_type = typeof raw.field_type === 'string' ? raw.field_type : undefined;
      this.detail = typeof raw.detail === 'string' ? raw.detail : undefined;
    }
  }
}

async function parseErrorBody(response: Response): Promise<{ message: string; raw?: Record<string, unknown> }> {
  const text = await response.text();
  if (!text) return { message: `HTTP ${response.status}` };
  try {
    const raw = JSON.parse(text);
    if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      const message = typeof obj.detail === 'string' ? obj.detail
        : typeof obj.title === 'string' ? obj.title
        : text;
      return { message, raw: obj };
    }
  } catch { /* fall through to text */ }
  return { message: text };
}

export interface CallApiOptions {
  /** Skip errorbus dispatch for expected failures (e.g. optional-param 404s). */
  silent?: boolean;
}

async function callApi(method: string, endpoint: string, data?: any, options?: CallApiOptions) {
  const silent = options?.silent === true;
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',  // Nutze Session Cookies für Auth
      body: data ? JSON.stringify(data) : undefined
    });
  } catch (netErr) {
    const message = netErr instanceof Error ? netErr.message : String(netErr);
    if (!silent) {
      window.dispatchEvent(new CustomEvent('errorbus:emit', { detail: {
        source: 'network', message, status: 0,
      } }));
    }
    throw netErr;
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) window.dispatchEvent(new Event('auth-error'));
    const { message, raw } = await parseErrorBody(response);
    const err = new LivingAppsApiError(message, response.status, raw);
    if (!silent) {
      window.dispatchEvent(new CustomEvent('errorbus:emit', { detail: {
        source: 'api',
        status: err.status,
        type: err.type,
        control_identifier: err.control_identifier,
        control_type: err.control_type,
        field_type: err.field_type,
        detail: err.detail,
        message: err.message,
      } }));
    }
    throw err;
  }
  // DELETE returns often empty body or simple status
  if (method === 'DELETE') return true;
  return response.json();
}

/** Upload a file to LivingApps. Returns the file URL for use in record fields. */
export async function uploadFile(file: File | Blob, filename?: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file, filename ?? (file instanceof File ? file.name : 'upload'));
  const res = await fetch(`${API_BASE_URL}/files`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) window.dispatchEvent(new Event('auth-error'));
    throw new Error(`File upload failed: ${res.status}`);
  }
  const data = await res.json();
  return data.url;
}

function enrichLookupFields<T extends { fields: Record<string, unknown> }>(
  records: T[], entityKey: string
): T[] {
  const opts = LOOKUP_OPTIONS[entityKey];
  if (!opts) return records;
  return records.map(r => {
    const fields = { ...r.fields };
    for (const [fieldKey, options] of Object.entries(opts)) {
      const val = fields[fieldKey];
      if (typeof val === 'string') {
        const m = options.find(o => o.key === val);
        fields[fieldKey] = m ?? { key: val, label: val };
      } else if (Array.isArray(val)) {
        fields[fieldKey] = val.map(v => {
          if (typeof v === 'string') {
            const m = options.find(o => o.key === v);
            return m ?? { key: v, label: v };
          }
          return v;
        });
      }
    }
    return { ...r, fields } as T;
  });
}

/** Normalize fields for API writes: strip lookup objects to keys, fix date formats. */
export function cleanFieldsForApi(
  fields: Record<string, unknown>,
  entityKey: string
): Record<string, unknown> {
  const clean: Record<string, unknown> = { ...fields };
  for (const [k, v] of Object.entries(clean)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && 'key' in v) clean[k] = (v as any).key;
    if (Array.isArray(v)) clean[k] = v.map((item: any) => item && typeof item === 'object' && 'key' in item ? item.key : item);
  }
  const types = FIELD_TYPES[entityKey];
  if (types) {
    for (const [k, ft] of Object.entries(types)) {
      if (!(k in clean)) continue;
      const val = clean[k];
      // applookup fields: undefined → null (clear single reference)
      if ((ft === 'applookup/select' || ft === 'applookup/choice') && val === undefined) { clean[k] = null; continue; }
      // multipleapplookup fields: undefined/null → [] (clear multi reference)
      if ((ft === 'multipleapplookup/select' || ft === 'multipleapplookup/choice') && (val === undefined || val === null)) { clean[k] = []; continue; }
      // lookup fields: undefined → null (clear single lookup)
      if ((ft.startsWith('lookup/')) && val === undefined) { clean[k] = null; continue; }
      // multiplelookup fields: undefined/null → [] (clear multi lookup)
      if ((ft.startsWith('multiplelookup/')) && (val === undefined || val === null)) { clean[k] = []; continue; }
      if (typeof val !== 'string' || !val) continue;
      if (ft === 'date/datetimeminute') clean[k] = val.slice(0, 16);
      else if (ft === 'date/date') clean[k] = val.slice(0, 10);
    }
  }
  return clean;
}

let _cachedUserProfile: Record<string, unknown> | null = null;

export async function getUserProfile(): Promise<Record<string, unknown>> {
  if (_cachedUserProfile) return _cachedUserProfile;
  const raw = await callApi('GET', '/user');
  const skip = new Set(['id', 'image', 'lang', 'gender', 'title', 'fax', 'menus', 'initials']);
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null && !skip.has(k)) data[k] = v;
  }
  _cachedUserProfile = data;
  return data;
}

export interface HeaderProfile {
  firstname: string;
  surname: string;
  email: string;
  image: string | null;
  company: string | null;
}

let _cachedHeaderProfile: HeaderProfile | null = null;

export async function getHeaderProfile(): Promise<HeaderProfile> {
  if (_cachedHeaderProfile) return _cachedHeaderProfile;
  const raw = await callApi('GET', '/user');
  _cachedHeaderProfile = {
    firstname: raw.firstname ?? '',
    surname: raw.surname ?? '',
    email: raw.email ?? '',
    image: raw.image ?? null,
    company: raw.company ?? null,
  };
  return _cachedHeaderProfile;
}

export interface AppGroupInfo {
  id: string;
  name: string;
  image: string | null;
  createdat: string;
  /** Resolved link: /objects/{id}/ if the dashboard exists, otherwise /gateway/apps/{firstAppId}?template=list_page */
  href: string;
}

let _cachedAppGroups: AppGroupInfo[] | null = null;

export async function getAppGroups(): Promise<AppGroupInfo[]> {
  if (_cachedAppGroups) return _cachedAppGroups;
  const raw = await callApi('GET', '/appgroups?with=apps');
  const groups: AppGroupInfo[] = Object.values(raw)
    .map((g: any) => {
      const firstAppId = Object.keys(g.apps ?? {})[0] ?? g.id;
      return {
        id: g.id,
        name: g.name,
        image: g.image ?? null,
        createdat: g.createdat ?? '',
        href: `/gateway/apps/${firstAppId}?template=list_page`,
        _firstAppId: firstAppId,
      };
    })
    .sort((a, b) => b.createdat.localeCompare(a.createdat));

  // Check which appgroups have a deployed dashboard via app params
  const paramChecks = await Promise.allSettled(
    groups.map(g => callApi('GET', `/apps/${(g as any)._firstAppId}/params/la_page_header_additional_url`, undefined, { silent: true }))
  );
  paramChecks.forEach((result, i) => {
    if (result.status !== 'fulfilled' || !result.value) return;
    const url = result.value.value;
    if (typeof url === 'string' && url.length > 0) {
      try { groups[i].href = new URL(url).pathname; } catch { groups[i].href = url; }
    }
  });

  // Clean up internal helper property
  groups.forEach(g => delete (g as any)._firstAppId);

  _cachedAppGroups = groups;
  return _cachedAppGroups;
}

export class LivingAppsService {
  // --- SKR03_KONTENPLAN ---
  static async getSkr03Kontenplan(): Promise<Skr03Kontenplan[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.SKR03_KONTENPLAN}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    })) as Skr03Kontenplan[];
    return enrichLookupFields(records, 'skr03_kontenplan');
  }
  static async getSkr03KontenplanEntry(id: string): Promise<Skr03Kontenplan | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.SKR03_KONTENPLAN}/records/${id}`);
    const record = { record_id: data.id, ...data } as Skr03Kontenplan;
    return enrichLookupFields([record], 'skr03_kontenplan')[0];
  }
  static async createSkr03KontenplanEntry(fields: CreateSkr03Kontenplan) {
    return callApi('POST', `/apps/${APP_IDS.SKR03_KONTENPLAN}/records`, { fields: cleanFieldsForApi(fields as any, 'skr03_kontenplan') });
  }
  static async updateSkr03KontenplanEntry(id: string, fields: Partial<CreateSkr03Kontenplan>) {
    return callApi('PATCH', `/apps/${APP_IDS.SKR03_KONTENPLAN}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'skr03_kontenplan') });
  }
  static async deleteSkr03KontenplanEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.SKR03_KONTENPLAN}/records/${id}`);
  }

  // --- STEUERPERIODEN ---
  static async getSteuerperioden(): Promise<Steuerperioden[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.STEUERPERIODEN}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    })) as Steuerperioden[];
    return enrichLookupFields(records, 'steuerperioden');
  }
  static async getSteuerperiodenEntry(id: string): Promise<Steuerperioden | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.STEUERPERIODEN}/records/${id}`);
    const record = { record_id: data.id, ...data } as Steuerperioden;
    return enrichLookupFields([record], 'steuerperioden')[0];
  }
  static async createSteuerperiodenEntry(fields: CreateSteuerperioden) {
    return callApi('POST', `/apps/${APP_IDS.STEUERPERIODEN}/records`, { fields: cleanFieldsForApi(fields as any, 'steuerperioden') });
  }
  static async updateSteuerperiodenEntry(id: string, fields: Partial<CreateSteuerperioden>) {
    return callApi('PATCH', `/apps/${APP_IDS.STEUERPERIODEN}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'steuerperioden') });
  }
  static async deleteSteuerperiodenEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.STEUERPERIODEN}/records/${id}`);
  }

  // --- LIEFERANTEN ---
  static async getLieferanten(): Promise<Lieferanten[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.LIEFERANTEN}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    })) as Lieferanten[];
    return enrichLookupFields(records, 'lieferanten');
  }
  static async getLieferantenEntry(id: string): Promise<Lieferanten | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.LIEFERANTEN}/records/${id}`);
    const record = { record_id: data.id, ...data } as Lieferanten;
    return enrichLookupFields([record], 'lieferanten')[0];
  }
  static async createLieferantenEntry(fields: CreateLieferanten) {
    return callApi('POST', `/apps/${APP_IDS.LIEFERANTEN}/records`, { fields: cleanFieldsForApi(fields as any, 'lieferanten') });
  }
  static async updateLieferantenEntry(id: string, fields: Partial<CreateLieferanten>) {
    return callApi('PATCH', `/apps/${APP_IDS.LIEFERANTEN}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'lieferanten') });
  }
  static async deleteLieferantenEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.LIEFERANTEN}/records/${id}`);
  }

  // --- BELEGE ---
  static async getBelege(): Promise<Belege[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.BELEGE}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    })) as Belege[];
    return enrichLookupFields(records, 'belege');
  }
  static async getBelegeEntry(id: string): Promise<Belege | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.BELEGE}/records/${id}`);
    const record = { record_id: data.id, ...data } as Belege;
    return enrichLookupFields([record], 'belege')[0];
  }
  static async createBelegeEntry(fields: CreateBelege) {
    return callApi('POST', `/apps/${APP_IDS.BELEGE}/records`, { fields: cleanFieldsForApi(fields as any, 'belege') });
  }
  static async updateBelegeEntry(id: string, fields: Partial<CreateBelege>) {
    return callApi('PATCH', `/apps/${APP_IDS.BELEGE}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'belege') });
  }
  static async deleteBelegeEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.BELEGE}/records/${id}`);
  }

  // --- BELEGPOSITIONEN ---
  static async getBelegpositionen(): Promise<Belegpositionen[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.BELEGPOSITIONEN}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    })) as Belegpositionen[];
    return enrichLookupFields(records, 'belegpositionen');
  }
  static async getBelegpositionenEntry(id: string): Promise<Belegpositionen | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.BELEGPOSITIONEN}/records/${id}`);
    const record = { record_id: data.id, ...data } as Belegpositionen;
    return enrichLookupFields([record], 'belegpositionen')[0];
  }
  static async createBelegpositionenEntry(fields: CreateBelegpositionen) {
    return callApi('POST', `/apps/${APP_IDS.BELEGPOSITIONEN}/records`, { fields: cleanFieldsForApi(fields as any, 'belegpositionen') });
  }
  static async updateBelegpositionenEntry(id: string, fields: Partial<CreateBelegpositionen>) {
    return callApi('PATCH', `/apps/${APP_IDS.BELEGPOSITIONEN}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'belegpositionen') });
  }
  static async deleteBelegpositionenEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.BELEGPOSITIONEN}/records/${id}`);
  }

  // --- LEASINGVERTRAEGE ---
  static async getLeasingvertraege(): Promise<Leasingvertraege[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.LEASINGVERTRAEGE}/records`);
    const records = Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    })) as Leasingvertraege[];
    return enrichLookupFields(records, 'leasingvertraege');
  }
  static async getLeasingvertraegeEntry(id: string): Promise<Leasingvertraege | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.LEASINGVERTRAEGE}/records/${id}`);
    const record = { record_id: data.id, ...data } as Leasingvertraege;
    return enrichLookupFields([record], 'leasingvertraege')[0];
  }
  static async createLeasingvertraegeEntry(fields: CreateLeasingvertraege) {
    return callApi('POST', `/apps/${APP_IDS.LEASINGVERTRAEGE}/records`, { fields: cleanFieldsForApi(fields as any, 'leasingvertraege') });
  }
  static async updateLeasingvertraegeEntry(id: string, fields: Partial<CreateLeasingvertraege>) {
    return callApi('PATCH', `/apps/${APP_IDS.LEASINGVERTRAEGE}/records/${id}`, { fields: cleanFieldsForApi(fields as any, 'leasingvertraege') });
  }
  static async deleteLeasingvertraegeEntry(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.LEASINGVERTRAEGE}/records/${id}`);
  }

}