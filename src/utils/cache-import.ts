/** Share an in-flight/successful import, but allow a failed prefetch to retry. */
export function cacheImport<T>(importer: () => Promise<T>): () => Promise<T> {
    let pending: Promise<T> | undefined;
    return () => {
        pending ??= Promise.resolve().then(importer).catch((error) => {
            pending = undefined;
            throw error;
        });
        return pending;
    };
}
