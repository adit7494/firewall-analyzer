/**
 * Safe Storage for uploaded configuration backups.
 * Handles enterprise config files (>5MB) that exceed sessionStorage quota limits.
 * Uses sessionStorage for metadata and IndexedDB (with memory cache fallback) for file content.
 */

const DB_NAME = 'FirewallAnalyzerDB';
const DB_VERSION = 1;
const STORE_NAME = 'config_cache';
const KEY_CONTENT = 'active_audit_content';

declare global {
  interface Window {
    __FIREWALL_CONFIG_CACHE__?: Record<string, string>;
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function setIndexedDBItem(key: string, value: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getIndexedDBItem(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function removeIndexedDBItem(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore error
  }
}

export interface UploadSessionData {
  fileContent: string;
  fileName: string;
  companyId: string;
  deviceId: string;
  vendor: string;
}

/**
 * Saves upload data safely into sessionStorage and/or IndexedDB / memory cache.
 */
export async function saveUploadData(data: UploadSessionData): Promise<void> {
  if (typeof window === 'undefined') return;

  // Save metadata
  sessionStorage.setItem('audit_upload_filename', data.fileName || 'backup.conf');
  sessionStorage.setItem('audit_upload_company_id', data.companyId);
  sessionStorage.setItem('audit_upload_device_id', data.deviceId);
  sessionStorage.setItem('audit_upload_vendor', data.vendor);

  // Store in memory cache immediately
  if (!window.__FIREWALL_CONFIG_CACHE__) {
    window.__FIREWALL_CONFIG_CACHE__ = {};
  }
  window.__FIREWALL_CONFIG_CACHE__[KEY_CONTENT] = data.fileContent;

  // Try storing file content in sessionStorage if small enough
  let savedToSessionStorage = false;
  if (data.fileContent.length < 2 * 1024 * 1024) { // Under 2MB
    try {
      sessionStorage.setItem('audit_upload_content', data.fileContent);
      sessionStorage.removeItem('audit_upload_storage_mode');
      savedToSessionStorage = true;
    } catch {
      savedToSessionStorage = false;
    }
  }

  if (!savedToSessionStorage) {
    // Fallback: Remove from sessionStorage to avoid quota errors and save to IndexedDB
    try {
      sessionStorage.removeItem('audit_upload_content');
    } catch {
      // Ignore error
    }
    
    sessionStorage.setItem('audit_upload_storage_mode', 'idb');
    try {
      await setIndexedDBItem(KEY_CONTENT, data.fileContent);
    } catch (idbErr) {
      console.warn('Failed to store config in IndexedDB, relying on memory cache:', idbErr);
    }
  }
}

/**
 * Loads upload data from sessionStorage and/or IndexedDB / memory cache.
 */
export async function loadUploadData(): Promise<UploadSessionData | null> {
  if (typeof window === 'undefined') return null;

  const fileName = sessionStorage.getItem('audit_upload_filename') ?? 'backup.conf';
  const companyId = sessionStorage.getItem('audit_upload_company_id') ?? '';
  const deviceId = sessionStorage.getItem('audit_upload_device_id') ?? '';
  const vendor = sessionStorage.getItem('audit_upload_vendor') ?? 'auto';
  const storageMode = sessionStorage.getItem('audit_upload_storage_mode');

  let fileContent: string | null = null;

  if (storageMode === 'idb') {
    // Read from IndexedDB first, fallback to window memory cache
    fileContent = await getIndexedDBItem(KEY_CONTENT);
    if (!fileContent && window.__FIREWALL_CONFIG_CACHE__) {
      fileContent = window.__FIREWALL_CONFIG_CACHE__[KEY_CONTENT] ?? null;
    }
  } else {
    // Read from sessionStorage first, fallback to IDB / memory
    try {
      fileContent = sessionStorage.getItem('audit_upload_content');
    } catch {
      // Ignore error
    }
    if (!fileContent) {
      fileContent = await getIndexedDBItem(KEY_CONTENT);
    }
    if (!fileContent && window.__FIREWALL_CONFIG_CACHE__) {
      fileContent = window.__FIREWALL_CONFIG_CACHE__[KEY_CONTENT] ?? null;
    }
  }

  if (!fileContent || !companyId || !deviceId) {
    return null;
  }

  return {
    fileContent,
    fileName,
    companyId,
    deviceId,
    vendor
  };
}

/**
 * Clears stored configuration data from all caches.
 */
export async function clearUploadData(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem('audit_upload_content');
    sessionStorage.removeItem('audit_upload_filename');
    sessionStorage.removeItem('audit_upload_company_id');
    sessionStorage.removeItem('audit_upload_device_id');
    sessionStorage.removeItem('audit_upload_vendor');
    sessionStorage.removeItem('audit_upload_storage_mode');
  } catch {
    // Ignore error
  }

  if (window.__FIREWALL_CONFIG_CACHE__) {
    delete window.__FIREWALL_CONFIG_CACHE__[KEY_CONTENT];
  }

  await removeIndexedDBItem(KEY_CONTENT);
}
