import { ImageType } from "@/types";
function uuid(): string {
    let idStr = Date.now().toString(36);
    idStr += Math.random().toString(36).substr(2);
    return idStr;
}

async function loadImageData(files: File[]): Promise<ImageType[]> {
    // 注意Promise<ImageType>[]和Promise<ImageType[]>
    const promises: Promise<ImageType>[] = files.map((file): Promise<ImageType> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = new Image();
                img.onload = function () {
                    resolve({
                        id: uuid(),
                        width: img.width,
                        height: img.height,
                        file: file,
                    });
                };
                img.onerror = reject;
                img.src = e.target.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    });
    return Promise.all(promises);
}

export { uuid, loadImageData };
