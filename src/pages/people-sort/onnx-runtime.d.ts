// TS's legacy Node resolver does not follow this package's /wasm export map.
declare module 'onnxruntime-web/wasm' {
    export * from 'onnxruntime-web';
}
