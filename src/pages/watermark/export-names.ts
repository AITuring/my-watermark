export function watermarkOutputName(filename:string,mimeType:string) {
    const stem=filename.replace(/\.[^.]+$/,'');
    return `${stem}-mark.${mimeType==='image/webp'?'webp':'jpg'}`;
}
export function uniqueArchiveName(filename:string,used:Set<string>) {
    const safe=filename.replace(/[\\/]/g,'_');
    const dot=safe.lastIndexOf('.');
    const stem=dot>0?safe.slice(0,dot):safe;
    const extension=dot>0?safe.slice(dot):'';
    let name=safe,count=2;
    while(used.has(name)) name=`${stem} (${count++})${extension}`;
    used.add(name);
    return name;
}
