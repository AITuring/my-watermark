import type { AspectRatio } from "./types";

export const aspectRatioOptions: AspectRatio[] = [
    { width: null, height: null, label: "自适应" },
    { width: 1, height: 1, label: "1:1" },
    { width: 4, height: 3, label: "4:3" },
    { width: 3, height: 4, label: "3:4" },
    { width: 16, height: 9, label: "16:9" },
    { width: 9, height: 16, label: "9:16" },
    { width: 2, height: 1, label: "2:1" },
    { width: 1, height: 2, label: "1:2" },
];
