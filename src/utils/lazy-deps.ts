let html2canvasPromise: Promise<typeof import("html2canvas").default> | null = null;
let jsZipPromise: Promise<unknown> | null = null;
let saveAsPromise: Promise<typeof import("file-saver").saveAs> | null = null;
let imageCompressionPromise: Promise<
    typeof import("browser-image-compression").default
> | null = null;
let exifReaderPromise: Promise<unknown> | null = null;
let openAIPromise: Promise<typeof import("openai").default> | null = null;

export const loadHtml2Canvas = async () => {
    html2canvasPromise ??= import("html2canvas").then((module) => module.default);
    return html2canvasPromise;
};

export const loadJSZip = async () => {
    jsZipPromise ??= import("jszip").then((module) => module.default ?? module);
    return jsZipPromise;
};

export const loadSaveAs = async () => {
    saveAsPromise ??= import("file-saver").then((module) => module.saveAs);
    return saveAsPromise;
};

export const loadImageCompression = async () => {
    imageCompressionPromise ??= import("browser-image-compression").then(
        (module) => module.default
    );
    return imageCompressionPromise;
};

export const loadExifReader = async () => {
    exifReaderPromise ??= import("exifreader").then(
        (module) => module.default ?? module
    );
    return exifReaderPromise;
};

export const loadOpenAI = async () => {
    openAIPromise ??= import("openai").then((module) => module.default);
    return openAIPromise;
};
