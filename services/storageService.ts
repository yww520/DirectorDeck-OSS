
/**
 * Storage Service
 * Handles persistence of application state using IndexedDB.
 */

const DB_NAME = 'dierctordeck3.0_DB';
const DB_VERSION = 5;

const STORES = {
    ASSETS: 'assets',
    IMAGES: 'images',
    CHARACTERS: 'characters',
    LOCATIONS: 'locations',
    STORYBOARD_PROJECTS: 'storyboard_projects',
    SETTINGS: 'settings',
    TIMELINE: 'timeline',
    SESSIONS: 'sessions',
    PROJECTS: 'projects',
    RECOVERY: 'recovery',
    API_CACHE: 'api_cache'
};

class StorageService {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                Object.values(STORES).forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        const store = db.createObjectStore(storeName, { keyPath: 'id' });
                        if (storeName !== STORES.SETTINGS && storeName !== STORES.PROJECTS) {
                            store.createIndex('projectId', 'projectId', { unique: false });
                        }
                    } else {
                        // If store exists, ensure index exists
                        const transaction = event.target.transaction;
                        const store = transaction.objectStore(storeName);
                        if (storeName !== STORES.SETTINGS && storeName !== STORES.PROJECTS && !store.indexNames.contains('projectId')) {
                            store.createIndex('projectId', 'projectId', { unique: false });
                        }
                    }
                });
            };

            request.onsuccess = (event: any) => {
                this.db = event.target.result;
                resolve();
            };

            request.onerror = (event: any) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
        if (!this.db) await this.init();
        const transaction = this.db!.transaction(storeName, mode);
        return transaction.objectStore(storeName);
    }

    // --- Generic CRUD ---

    async saveItem(storeName: string, item: any): Promise<void> {
        const store = await this.getStore(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.put(item);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async saveItems(storeName: string, items: any[]): Promise<void> {
        if (items.length === 0) {
            await this.clearStore(storeName);
            return;
        }

        const store = await this.getStore(storeName, 'readwrite');

        // Clear existing first for some stores if needed, or just let put handle it by ID
        // Note: clearing first ensures that items removed from the state are also removed from IDB
        await new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });

        return new Promise((resolve, reject) => {
            let completed = 0;
            let hasError = false;

            items.forEach(item => {
                const request = store.put(item);
                request.onsuccess = () => {
                    completed++;
                    if (completed === items.length && !hasError) resolve();
                };
                request.onerror = () => {
                    hasError = true;
                    reject(request.error);
                };
            });
        });
    }

    async getAllItems<T>(storeName: string): Promise<T[]> {
        const store = await this.getStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteItem(storeName: string, id: string): Promise<void> {
        const store = await this.getStore(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async saveItemsForProject(storeName: string, items: any[], projectId: string): Promise<void> {
        const store = await this.getStore(storeName, 'readwrite');
        const index = store.index('projectId');

        // 1. Delete all items for this project using the index
        return new Promise((resolve, reject) => {
            const range = IDBKeyRange.only(projectId);
            const deleteRequest = index.openKeyCursor(range);

            deleteRequest.onsuccess = (event: any) => {
                const cursor = event.target.result;
                if (cursor) {
                    try {
                        store.delete(cursor.primaryKey);
                    } catch (e) {
                        console.warn("[Storage] Failed to delete item during migration:", e);
                    }
                    cursor.continue();
                } else {
                    // 2. All old project items deleted, now put new items
                    if (items.length === 0) {
                        resolve();
                        return;
                    }

                    let completed = 0;
                    items.forEach(item => {
                        const putRequest = store.put({ ...item, projectId });
                        putRequest.onsuccess = () => {
                            completed++;
                            if (completed === items.length) resolve();
                        };
                        putRequest.onerror = () => reject(putRequest.error);
                    });
                }
            };
            deleteRequest.onerror = () => reject(deleteRequest.error);
        });
    }

    async getItemsForProject<T>(storeName: string, projectId: string): Promise<T[]> {
        try {
            const store = await this.getStore(storeName);
            if (!store.indexNames.contains('projectId')) {
                console.warn(`[Storage] Index 'projectId' missing on store ${storeName}. Performing full scan fallback.`);
                const all = await this.getAllItems<any>(storeName);
                return (all.filter(item => item.projectId === projectId) as T[]);
            }
            const index = store.index('projectId');
            return new Promise((resolve, reject) => {
                const request = index.getAll(IDBKeyRange.only(projectId));
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.error(`[Storage] Failed to get items for project ${projectId} from ${storeName}:`, e);
            return [];
        }
    }

    async clearStore(storeName: string): Promise<void> {
        const store = await this.getStore(storeName, 'readwrite');
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // --- Specific Helpers ---

    async saveAssets(assets: any[]) {
        // We store the File objects directly in IDB
        return this.saveItems(STORES.ASSETS, assets);
    }

    async saveImages(images: any[]) {
        return this.saveItems(STORES.IMAGES, images);
    }

    async saveCharacters(characters: any[]) {
        return this.saveItems(STORES.CHARACTERS, characters);
    }

    async saveLocations(locations: any[]) {
        return this.saveItems(STORES.LOCATIONS, locations);
    }

    async saveStoryboardProjects(projects: any[]) {
        return this.saveItems(STORES.STORYBOARD_PROJECTS, projects);
    }

    async saveSettings(settings: any) {
        return this.saveItem(STORES.SETTINGS, { id: 'global_settings', ...settings });
    }

    async getSettings() {
        const store = await this.getStore(STORES.SETTINGS);
        return new Promise((resolve) => {
            const request = store.get('global_settings');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    }

    async saveTimeline(timeline: any) {
        // Timeline is now project-specific, using its id or projectid
        return this.saveItem(STORES.TIMELINE, timeline);
    }

    async getTimeline(projectId: string) {
        const timelines = await this.getAllItems<any>(STORES.TIMELINE);
        return timelines.find(t => t.projectId === projectId) || null;
    }

    async saveSessions(sessions: any[], projectId: string) {
        return this.saveItemsForProject(STORES.SESSIONS, sessions, projectId);
    }

    async getSessions(projectId?: string): Promise<any[]> {
        if (projectId) {
            return this.getItemsForProject(STORES.SESSIONS, projectId);
        }
        return this.getAllItems(STORES.SESSIONS);
    }

    // --- Projects ---
    async saveProjects(projects: any[]) {
        return this.saveItems(STORES.PROJECTS, projects);
    }

    async getAllProjects(): Promise<any[]> {
        return this.getAllItems(STORES.PROJECTS);
    }

    async deleteProject(projectId: string) {
        // In a real app we might want to delete all associated items too
        // For now just delete the project entry
        return this.deleteItem(STORES.PROJECTS, projectId);
    }

    // --- Recovery ---
    async saveRecoverySnapshots(snapshots: any[]) {
        return this.saveItems(STORES.RECOVERY, snapshots);
    }

    async getRecoverySnapshots(): Promise<any[]> {
        return this.getAllItems(STORES.RECOVERY);
    }

    async clearRecoverySnapshots() {
        return this.clearStore(STORES.RECOVERY);
    }

    // --- API Cache ---
    async saveCacheEntry(entry: any) {
        return this.saveItem(STORES.API_CACHE, entry);
    }

    async getCacheEntry(id: string) {
        const store = await this.getStore(STORES.API_CACHE);
        return new Promise((resolve) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    }

    async getAllCacheEntries() {
        return this.getAllItems(STORES.API_CACHE);
    }

    async deleteCacheEntry(id: string) {
        return this.deleteItem(STORES.API_CACHE, id);
    }

    async clearCache() {
        return this.clearStore(STORES.API_CACHE);
    }
}

export const storageService = new StorageService();
