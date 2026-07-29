import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    clamp,
    DOUBLE_CLICK_ZOOM,
    MAX_INSPECT_ZOOM,
    MIN_INSPECT_ZOOM,
} from "../helpers";
import type { InspectMetrics, InspectViewport } from "../types";

interface UseFocusStackInspectOptions {
    imageWidth: number;
    imageHeight: number;
    isOpen: boolean;
}

interface DragState {
    pointerId: number;
    panelKey: string;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
}

export function useFocusStackInspect({
    imageWidth,
    imageHeight,
    isOpen,
}: UseFocusStackInspectOptions) {
    const [inspectZoom, setInspectZoom] = useState(1);
    const [inspectViewport, setInspectViewport] = useState<InspectViewport>({
        x: 0,
        y: 0,
    });
    const [inspectMetrics, setInspectMetrics] = useState<InspectMetrics>({
        viewportWidth: 0,
        viewportHeight: 0,
    });
    const [draggingPanelKey, setDraggingPanelKey] = useState<string | null>(null);
    const inspectContainersRef = useRef<Record<string, HTMLDivElement | null>>({});
    const syncScrollRef = useRef(false);
    const dragStateRef = useRef<DragState | null>(null);

    const inspectImageSize = useMemo(
        () => ({
            width: imageWidth || 1,
            height: imageHeight || 1,
        }),
        [imageHeight, imageWidth]
    );

    const getInspectRenderScale = useCallback(
        (container: HTMLDivElement, zoom: number) => {
            const fitScale = Math.min(
                container.clientWidth / Math.max(inspectImageSize.width, 1),
                container.clientHeight / Math.max(inspectImageSize.height, 1)
            );
            return fitScale * zoom;
        },
        [inspectImageSize]
    );

    const getInspectBounds = useCallback(
        (container: HTMLDivElement, zoom: number) => {
            const renderScale = getInspectRenderScale(container, zoom);
            const contentWidth = inspectImageSize.width * renderScale;
            const contentHeight = inspectImageSize.height * renderScale;
            const maxScrollLeft = Math.max(0, contentWidth - container.clientWidth);
            const maxScrollTop = Math.max(0, contentHeight - container.clientHeight);
            return {
                renderScale,
                contentWidth,
                contentHeight,
                maxScrollLeft,
                maxScrollTop,
            };
        },
        [getInspectRenderScale, inspectImageSize]
    );

    const updateInspectMetrics = useCallback(() => {
        const firstContainer = Object.values(inspectContainersRef.current).find(Boolean);
        if (!firstContainer) {
            return;
        }
        setInspectMetrics({
            viewportWidth: firstContainer.clientWidth,
            viewportHeight: firstContainer.clientHeight,
        });
    }, []);

    const getInspectLayout = useCallback(
        (panelKey: string) => {
            const container = inspectContainersRef.current[panelKey];
            const viewportWidth = container?.clientWidth || inspectMetrics.viewportWidth || 1;
            const viewportHeight = container?.clientHeight || inspectMetrics.viewportHeight || 1;
            const fitScale = Math.min(
                viewportWidth / Math.max(inspectImageSize.width, 1),
                viewportHeight / Math.max(inspectImageSize.height, 1)
            );
            const renderScale = fitScale * inspectZoom;
            const renderedWidth = inspectImageSize.width * renderScale;
            const renderedHeight = inspectImageSize.height * renderScale;
            return {
                renderedWidth,
                renderedHeight,
                wrapperWidth: Math.max(viewportWidth, renderedWidth),
                wrapperHeight: Math.max(viewportHeight, renderedHeight),
            };
        },
        [inspectImageSize, inspectMetrics, inspectZoom]
    );

    const syncInspectScroll = useCallback(
        (viewport: InspectViewport) => {
            syncScrollRef.current = true;
            Object.values(inspectContainersRef.current).forEach((container) => {
                if (!container) {
                    return;
                }
                const { maxScrollLeft, maxScrollTop } = getInspectBounds(container, inspectZoom);
                container.scrollLeft = maxScrollLeft * viewport.x;
                container.scrollTop = maxScrollTop * viewport.y;
            });
            requestAnimationFrame(() => {
                syncScrollRef.current = false;
            });
            updateInspectMetrics();
        },
        [getInspectBounds, inspectZoom, updateInspectMetrics]
    );

    const updateViewportFromScroll = useCallback(
        (container: HTMLDivElement) => {
            const { maxScrollLeft, maxScrollTop } = getInspectBounds(container, inspectZoom);
            const nextViewport = {
                x: maxScrollLeft > 0 ? container.scrollLeft / maxScrollLeft : 0,
                y: maxScrollTop > 0 ? container.scrollTop / maxScrollTop : 0,
            };
            setInspectViewport(nextViewport);
            setInspectMetrics({
                viewportWidth: container.clientWidth,
                viewportHeight: container.clientHeight,
            });
            return nextViewport;
        },
        [getInspectBounds, inspectZoom]
    );

    const zoomToPoint = useCallback(
        (
            container: HTMLDivElement,
            clientX: number,
            clientY: number,
            nextZoom: number
        ) => {
            const rect = container.getBoundingClientRect();
            const offsetX = clientX - rect.left + container.scrollLeft;
            const offsetY = clientY - rect.top + container.scrollTop;
            const currentScale = getInspectRenderScale(container, inspectZoom);
            const imageX = offsetX / currentScale;
            const imageY = offsetY / currentScale;
            const { renderScale: nextScale, maxScrollLeft, maxScrollTop } = getInspectBounds(
                container,
                nextZoom
            );
            const nextScrollLeft = clamp(
                imageX * nextScale - (clientX - rect.left),
                0,
                maxScrollLeft
            );
            const nextScrollTop = clamp(
                imageY * nextScale - (clientY - rect.top),
                0,
                maxScrollTop
            );
            const nextViewport = {
                x: maxScrollLeft > 0 ? nextScrollLeft / maxScrollLeft : 0,
                y: maxScrollTop > 0 ? nextScrollTop / maxScrollTop : 0,
            };
            setInspectZoom(nextZoom);
            setInspectViewport(nextViewport);
        },
        [getInspectBounds, getInspectRenderScale, inspectZoom]
    );

    const handleInspectScroll = useCallback(
        (panelKey: string) => {
            const container = inspectContainersRef.current[panelKey];
            if (!container || syncScrollRef.current) {
                return;
            }
            const nextViewport = updateViewportFromScroll(container);
            syncScrollRef.current = true;
            Object.entries(inspectContainersRef.current).forEach(([key, target]) => {
                if (!target || key === panelKey) {
                    return;
                }
                const { maxScrollLeft, maxScrollTop } = getInspectBounds(target, inspectZoom);
                target.scrollLeft = maxScrollLeft * nextViewport.x;
                target.scrollTop = maxScrollTop * nextViewport.y;
            });
            requestAnimationFrame(() => {
                syncScrollRef.current = false;
            });
        },
        [getInspectBounds, inspectZoom, updateViewportFromScroll]
    );

    const handleInspectWheel = useCallback(
        (panelKey: string, event: React.WheelEvent<HTMLDivElement>) => {
            event.preventDefault();
            const container = inspectContainersRef.current[panelKey];
            if (!container) {
                return;
            }
            const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
            const nextZoom = clamp(inspectZoom * factor, MIN_INSPECT_ZOOM, MAX_INSPECT_ZOOM);
            if (nextZoom === inspectZoom) {
                return;
            }
            zoomToPoint(container, event.clientX, event.clientY, nextZoom);
        },
        [inspectZoom, zoomToPoint]
    );

    const handleInspectDoubleClick = useCallback(
        (panelKey: string, event: React.MouseEvent<HTMLDivElement>) => {
            const container = inspectContainersRef.current[panelKey];
            if (!container) {
                return;
            }
            const nextZoom =
                Math.abs(inspectZoom - DOUBLE_CLICK_ZOOM) < 0.05
                    ? MIN_INSPECT_ZOOM
                    : DOUBLE_CLICK_ZOOM;
            zoomToPoint(container, event.clientX, event.clientY, nextZoom);
        },
        [inspectZoom, zoomToPoint]
    );

    const handleInspectPointerDown = useCallback(
        (panelKey: string, event: React.PointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) {
                return;
            }
            const container = inspectContainersRef.current[panelKey];
            if (!container) {
                return;
            }
            dragStateRef.current = {
                pointerId: event.pointerId,
                panelKey,
                startX: event.clientX,
                startY: event.clientY,
                startScrollLeft: container.scrollLeft,
                startScrollTop: container.scrollTop,
            };
            setDraggingPanelKey(panelKey);
            container.setPointerCapture(event.pointerId);
        },
        []
    );

    const handleInspectPointerMove = useCallback(
        (panelKey: string, event: React.PointerEvent<HTMLDivElement>) => {
            const dragState = dragStateRef.current;
            if (
                !dragState ||
                dragState.panelKey !== panelKey ||
                dragState.pointerId !== event.pointerId
            ) {
                return;
            }
            const container = inspectContainersRef.current[panelKey];
            if (!container) {
                return;
            }
            const { maxScrollLeft, maxScrollTop } = getInspectBounds(container, inspectZoom);
            const nextScrollLeft = clamp(
                dragState.startScrollLeft - (event.clientX - dragState.startX),
                0,
                maxScrollLeft
            );
            const nextScrollTop = clamp(
                dragState.startScrollTop - (event.clientY - dragState.startY),
                0,
                maxScrollTop
            );
            const nextViewport = {
                x: maxScrollLeft > 0 ? nextScrollLeft / maxScrollLeft : 0,
                y: maxScrollTop > 0 ? nextScrollTop / maxScrollTop : 0,
            };
            setInspectViewport(nextViewport);
            syncInspectScroll(nextViewport);
        },
        [getInspectBounds, inspectZoom, syncInspectScroll]
    );

    const handleInspectPointerUp = useCallback(
        (panelKey: string, event: React.PointerEvent<HTMLDivElement>) => {
            const dragState = dragStateRef.current;
            if (
                !dragState ||
                dragState.panelKey !== panelKey ||
                dragState.pointerId !== event.pointerId
            ) {
                return;
            }
            const container = inspectContainersRef.current[panelKey];
            if (container?.hasPointerCapture(event.pointerId)) {
                container.releasePointerCapture(event.pointerId);
            }
            dragStateRef.current = null;
            setDraggingPanelKey(null);
        },
        []
    );

    const handleMinimapJump = useCallback(
        (panelKey: string, event: React.PointerEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            const container = inspectContainersRef.current[panelKey];
            if (!container) {
                return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            const { contentWidth, contentHeight } = getInspectBounds(container, inspectZoom);
            const viewportRatioX = Math.min(1, container.clientWidth / contentWidth);
            const viewportRatioY = Math.min(1, container.clientHeight / contentHeight);
            const nextViewport = {
                x: clamp(
                    ((event.clientX - rect.left) / rect.width - viewportRatioX / 2) /
                        Math.max(1 - viewportRatioX, 0.0001),
                    0,
                    1
                ),
                y: clamp(
                    ((event.clientY - rect.top) / rect.height - viewportRatioY / 2) /
                        Math.max(1 - viewportRatioY, 0.0001),
                    0,
                    1
                ),
            };
            setInspectViewport(nextViewport);
            syncInspectScroll(nextViewport);
        },
        [getInspectBounds, inspectZoom, syncInspectScroll]
    );

    const registerInspectContainer = useCallback(
        (panelKey: string, node: HTMLDivElement | null) => {
            inspectContainersRef.current[panelKey] = node;
        },
        []
    );

    const resetInspectView = useCallback(() => {
        setInspectZoom(1);
        setInspectViewport({
            x: 0,
            y: 0,
        });
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const frame = requestAnimationFrame(() => {
            syncInspectScroll(inspectViewport);
        });
        return () => cancelAnimationFrame(frame);
    }, [inspectViewport, inspectZoom, isOpen, syncInspectScroll]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const handleResize = () => {
            updateInspectMetrics();
            syncInspectScroll(inspectViewport);
        };
        window.addEventListener("resize", handleResize);
        const frame = requestAnimationFrame(handleResize);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", handleResize);
        };
    }, [inspectViewport, isOpen, inspectZoom, syncInspectScroll, updateInspectMetrics]);

    return {
        inspectZoom,
        inspectViewport,
        inspectMetrics,
        draggingPanelKey,
        inspectImageSize,
        setInspectZoom,
        resetInspectView,
        registerInspectContainer,
        getInspectLayout,
        handleInspectScroll,
        handleInspectWheel,
        handleInspectDoubleClick,
        handleInspectPointerDown,
        handleInspectPointerMove,
        handleInspectPointerUp,
        handleMinimapJump,
    };
}
