import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MuseumEvent } from "../types";

interface MapNavigationDialogProps {
  open: boolean;
  selectedEvent: MuseumEvent | null;
  onOpenChange: (open: boolean) => void;
}

const MapNavigationDialog: React.FC<MapNavigationDialogProps> = ({ open, selectedEvent, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle>选择地图导航</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {selectedEvent ? (
            <>
              <a
                href={`https://uri.amap.com/search?query=${encodeURIComponent(selectedEvent.address || `${selectedEvent.city}${selectedEvent.museum}`)}`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                打开高德地图
              </a>
              <a
                href={`https://api.map.baidu.com/place/search?query=${encodeURIComponent(selectedEvent.address || selectedEvent.museum)}&region=${encodeURIComponent(selectedEvent.city)}&output=html`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                打开百度地图
              </a>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.address || `${selectedEvent.city}${selectedEvent.museum}`)}`}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                打开 Google Maps
              </a>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MapNavigationDialog;
