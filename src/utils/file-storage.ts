const FILE_STORAGE_DB_NAME = "my-watermark-file-storage";
const FILE_STORAGE_DB_VERSION = 1;
const FILE_SESSIONS_STORE = "file-sessions";

type FileSessionRecord = {
    key: string;
    files: File[];
    updatedAt: number;
};

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
    if (databasePromise) {
        return databasePromise;
    }

    databasePromise = new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !window.indexedDB) {
            reject(new Error("IndexedDB unavailable"));
            return;
        }

        const request = window.indexedDB.open(
            FILE_STORAGE_DB_NAME,
            FILE_STORAGE_DB_VERSION
        );
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(FILE_SESSIONS_STORE)) {
                database.createObjectStore(FILE_SESSIONS_STORE, { keyPath: "key" });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    });

    return databasePromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    });
}

const memorySessions = new Map<string, File[]>();

export async function saveFileSession(key: string, files: File[]): Promise<void> {
    const snapshot = [...files];
    memorySessions.set(key, snapshot);

    try {
        const database = await openDatabase();
        const transaction = database.transaction(FILE_SESSIONS_STORE, "readwrite");
        transaction.objectStore(FILE_SESSIONS_STORE).put({
            key,
            files: snapshot,
            updatedAt: Date.now(),
        } satisfies FileSessionRecord);
        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB write failed"));
            transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB write aborted"));
        });
    } catch (error) {
        // The in-memory copy still keeps the current SPA navigation usable.
        console.warn(`无法持久化文件会话 ${key}`, error);
    }
}

export async function loadFileSession(key: string): Promise<File[]> {
    try {
        const database = await openDatabase();
        const transaction = database.transaction(FILE_SESSIONS_STORE, "readonly");
        const record = await requestToPromise<FileSessionRecord | undefined>(
            transaction.objectStore(FILE_SESSIONS_STORE).get(key)
        );
        if (record?.files?.length) {
            const files = [...record.files];
            memorySessions.set(key, files);
            return files;
        }
    } catch (error) {
        console.warn(`无法读取文件会话 ${key}`, error);
    }

    return [...(memorySessions.get(key) ?? [])];
}

export async function clearFileSession(key: string): Promise<void> {
    memorySessions.delete(key);
    try {
        const database = await openDatabase();
        const transaction = database.transaction(FILE_SESSIONS_STORE, "readwrite");
        transaction.objectStore(FILE_SESSIONS_STORE).delete(key);
        await new Promise<void>((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB delete failed"));
            transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB delete aborted"));
        });
    } catch (error) {
        console.warn(`无法清理文件会话 ${key}`, error);
    }
}
