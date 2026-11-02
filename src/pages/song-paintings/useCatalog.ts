import { useEffect, useRef, useState } from "react";
import { createProgress, parseProgress, VISITOR_STORAGE_KEY, type Artwork, type Catalog } from "./model";

export type CatalogMode = "visitor" | "personal";
export type ArtworkChanges = Partial<Pick<Artwork, "read" | "title" | "artist" | "period" | "collection" | "volume" | "book" | "sequence" | "page" | "catalogPdfPage">>;
type LocalResponse = { catalog: Catalog; revision: string; token?: string; error?: string };
const validIdsFor = (catalog: Catalog) => new Set(catalog.artworks.map((item) => item.id));
const withReadIds = (catalog: Catalog, ids: ReadonlySet<string>): Catalog => ({ ...catalog, artworks: catalog.artworks.map((item) => ({ ...item, read: ids.has(item.id) })) });
const idsFor = (catalog: Catalog) => new Set(catalog.artworks.filter((item) => item.read === true).map((item) => item.id));

function visitorInitial(source: Catalog) {
    try {
        const saved = localStorage.getItem(VISITOR_STORAGE_KEY);
        const ids = saved ? parseProgress(saved, validIdsFor(source)) : new Set<string>();
        return { catalog: withReadIds(source, ids), warning: "", blocked: false };
    } catch (error) {
        const blocked = error instanceof Error && error.name !== "SecurityError";
        return { catalog: withReadIds(source, new Set()), warning: blocked ? "阅读记录无法读取，已暂停勾选。请导入有效备份恢复。" : "浏览器无法保存记录，请导出数据保留本次阅读进度。", blocked };
    }
}

export function useCatalog(source: Catalog, mode: CatalogMode) {
    const [state, setState] = useState(() => mode === "visitor" ? visitorInitial(source) : { catalog: source, warning: "", blocked: false });
    const [connected, setConnected] = useState(false);
    const [saving, setSaving] = useState(false);
    const stateRef = useRef(state);
    const busy = useRef(false);
    const generation = useRef(0);
    const connection = useRef({ token: "", revision: "" });
    stateRef.current = state;
    const devPersonal = import.meta.env.DEV && mode === "personal";

    const update = (next: typeof state) => { stateRef.current = next; setState(next); };

    useEffect(() => {
        let alive = true;
        const refresh = async () => {
            if (mode === "visitor") {
                // Visitor progress never inherits the author's published read flags.
                setState((previous) => ({ ...previous, catalog: withReadIds(source, idsFor(previous.catalog)) }));
                return;
            }
            if (!import.meta.env.DEV) { setState({ catalog: source, warning: "", blocked: false }); return; }
            if (busy.current) return;
            const refreshGeneration = ++generation.current;
            try {
                const response = await fetch("/__song_catalog", { cache: "no-store" });
                const data = await response.json() as LocalResponse;
                if (!response.ok || !data.catalog || !data.token) throw new Error(data.error || "本地编辑服务不可用");
                if (!alive || busy.current || refreshGeneration !== generation.current) return;
                connection.current = { revision: data.revision, token: data.token };
                setState({ catalog: data.catalog, warning: "", blocked: false });
                setConnected(true);
            } catch {
                if (alive && refreshGeneration === generation.current) { setConnected(false); setState((previous) => ({ ...previous, warning: "未连接本地编辑服务，当前仅可查看。请从本机 dev 地址打开或刷新重试。" })); }
            }
        };
        void refresh();
        const onVisible = () => { if (document.visibilityState === "visible" && devPersonal && !busy.current) void refresh(); };
        const onStorage = (event: StorageEvent) => {
            if (mode !== "visitor" || (event.key !== VISITOR_STORAGE_KEY && event.key !== null)) return;
            setState((previous) => previous.warning && !previous.blocked
                ? { ...previous, warning: "其他标签页更新了记录。本页仍有未保存的勾选，请先导出阅读记录。" }
                : visitorInitial(source));
        };
        document.addEventListener("visibilitychange", onVisible);
        window.addEventListener("storage", onStorage);
        return () => { alive = false; document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("storage", onStorage); };
    }, [source, mode, devPersonal]);

    const saveLocal = async (payload: { id: string; changes: ArtworkChanges } | { readIds: string[] }): Promise<boolean> => {
        if (!import.meta.env.DEV || mode !== "personal" || !connected || busy.current) return false;
        busy.current = true;
        generation.current += 1;
        setSaving(true);
        const previous = stateRef.current;
        const optimistic = "readIds" in payload
            ? withReadIds(previous.catalog, new Set([...idsFor(previous.catalog), ...payload.readIds]))
            : { ...previous.catalog, artworks: previous.catalog.artworks.map((item) => item.id === payload.id ? { ...item, ...payload.changes } : item) };
        update({ catalog: optimistic, warning: "", blocked: false });
        try {
            const response = await fetch("/__song_catalog", {
                method: "POST", headers: { "Content-Type": "application/json", "x-song-catalog-token": connection.current.token },
                body: JSON.stringify({ revision: connection.current.revision, ...payload }),
            });
            const data = await response.json() as LocalResponse;
            if (!response.ok) throw new Error(data.error || "保存失败");
            connection.current.revision = data.revision;
            update({ catalog: data.catalog, warning: "", blocked: false });
            return true;
        } catch (error) {
            // Reload after a conflict instead of restoring an older copy over a newer save.
            let latest = previous.catalog;
            try {
                const response = await fetch("/__song_catalog", { cache: "no-store" });
                const data = await response.json() as LocalResponse;
                if (response.ok && data.catalog && data.token) { latest = data.catalog; connection.current = { revision: data.revision, token: data.token }; }
            } catch { /* Retain the last confirmed catalog when disconnected. */ }
            update({ catalog: latest, warning: `${error instanceof Error ? error.message : "保存失败"}。本次修改未保存，请检查后重试。`, blocked: false });
            return false;
        } finally { busy.current = false; setSaving(false); }
    };

    const saveVisitor = async (modify: (ids: Set<string>) => void) => {
        if (mode !== "visitor") return false;
        const action = () => {
            let ids = idsFor(stateRef.current.catalog);
            try {
                const saved = localStorage.getItem(VISITOR_STORAGE_KEY);
                if (saved && !stateRef.current.warning) ids = parseProgress(saved, validIdsFor(source));
            } catch (error) {
                if (error instanceof Error && error.name !== "SecurityError") { update({ ...stateRef.current, warning: "已有记录无法读取，已停止覆盖。请导入有效备份恢复。", blocked: true }); return false; }
            }
            modify(ids);
            const next = withReadIds(source, ids);
            try {
                localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(createProgress(ids)));
                update({ catalog: next, warning: "", blocked: false });
            } catch { update({ catalog: next, warning: "保存失败，本次勾选仅在当前页保留。请导出阅读记录备份。", blocked: false }); }
            return true;
        };
        return navigator.locks?.request ? navigator.locks.request(VISITOR_STORAGE_KEY, action) : action();
    };

    const toggleRead = async (id: string, read: boolean) => {
        if (mode === "personal") return saveLocal({ id, changes: { read } });
        if (stateRef.current.blocked) return false;
        const ids = idsFor(stateRef.current.catalog);
        if (read) ids.add(id); else ids.delete(id);
        update({ ...stateRef.current, catalog: withReadIds(source, ids) });
        return saveVisitor((latest) => { if (read) latest.add(id); else latest.delete(id); });
    };

    const mergeProgress = async (ids: ReadonlySet<string>) => mode === "personal"
        ? saveLocal({ readIds: [...ids] })
        : saveVisitor((latest) => { ids.forEach((id) => latest.add(id)); });

    return {
        catalog: state.catalog, readIds: idsFor(state.catalog), warning: state.warning, saving,
        canEditReading: mode === "visitor" ? !state.blocked : devPersonal && connected,
        canEditMetadata: devPersonal && connected,
        toggleRead, mergeProgress, saveArtwork: (id: string, changes: ArtworkChanges) => saveLocal({ id, changes }),
    };
}
