export interface Artifact {
    id: number;
    batch: string;
    type: string;
    name: string;
    era: string;
    excavationLocation: string;
    excavationTime: string;
    collectionLocation: string;
    desc: string;
    image?: string;
    detail?: string;
}

export interface LocationCoordinate {
    lng: number;
    lat: number;
    address: string;
    artifacts: Artifact[];
}

declare global {
    interface Window {
        AMap: any;
        _AMapSecurityConfig: any;
        openArtifact?: (id: number) => void;
    }
}
