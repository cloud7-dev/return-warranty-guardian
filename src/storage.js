const DB_NAME = "return-warranty-guardian";
const STORE_NAME = "settings";
const DATA_KEY = "purchases";
const LOCAL_STORAGE_KEY = "rwg:purchases";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
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

export async function loadPurchases() {
  try {
    const db = await openDatabase();
    if (!db) throw new Error("IndexedDB unavailable");
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(DATA_KEY);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
  }
}

export async function savePurchases(purchases) {
  try {
    const db = await openDatabase();
    if (!db) throw new Error("IndexedDB unavailable");
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(purchases, DATA_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(purchases));
  }
}
