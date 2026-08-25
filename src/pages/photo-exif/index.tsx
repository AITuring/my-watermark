import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    accentButtonClass,
    dangerButtonClass,
    dangerSubtleButtonClass,
    primaryButtonClass,
    secondaryButtonClass,
} from "@/pages/photo-exif/constants";
import BatchTabContent from "@/pages/photo-exif/components/BatchTabContent";
import ImportConfirmDialog from "@/pages/photo-exif/components/ImportConfirmDialog";
import ImportPanel from "@/pages/photo-exif/components/ImportPanel";
import PhotoListPanel from "@/pages/photo-exif/components/PhotoListPanel";
import StatsOverview from "@/pages/photo-exif/components/StatsOverview";
import UploadPermissionDialog from "@/pages/photo-exif/components/UploadPermissionDialog";
import ViewerTabContent from "@/pages/photo-exif/components/ViewerTabContent";
import WorkbenchHeader from "@/pages/photo-exif/components/WorkbenchHeader";
import { usePhotoExifWorkbench } from "@/pages/photo-exif/hooks/usePhotoExifWorkbench";

const PhotoExifWorkbench: React.FC = () => {
    const workbench = usePhotoExifWorkbench();
    const { stats, preferences, selection, importFlow, batchFlow, singleFlow } = workbench;

    return (
        <div className="min-h-screen bg-background px-4 py-4 text-foreground lg:px-5">
            <div className="mx-auto max-w-[1680px] space-y-5">
                <WorkbenchHeader
                    hasItems={workbench.items.length > 0}
                    dangerSubtleButtonClass={dangerSubtleButtonClass}
                    onClearAll={workbench.clearAll}
                />

                <ImportPanel
                    accentButtonClass={accentButtonClass}
                    getInputProps={importFlow.getInputProps}
                    getRootProps={importFlow.getRootProps}
                    isBindingDirectory={importFlow.isBindingDirectory}
                    isDragActive={importFlow.isDragActive}
                    isImportingDirectory={importFlow.isImportingDirectory}
                    bindableCount={stats.bindableCount}
                    directoryHandleName={importFlow.directoryHandle?.name ?? null}
                    hasItems={workbench.items.length > 0}
                    itemCount={stats.itemCount}
                    linkedCount={stats.linkedCount}
                    openFilePicker={importFlow.open}
                    onBindDirectory={() => void importFlow.handleBindUploadedItemsToDirectory()}
                    onSelectDirectory={() => void importFlow.handleSelectDirectory()}
                    primaryButtonClass={primaryButtonClass}
                    secondaryButtonClass={secondaryButtonClass}
                />

                {workbench.items.length > 0 && (
                    <>
                        <StatsOverview
                            dirtyCount={stats.dirtyCount}
                            gpsCount={stats.gpsCount}
                            inplaceCount={stats.inplaceCount}
                            itemCount={stats.itemCount}
                            writableCount={stats.writableCount}
                        />

                        <div className="grid gap-5 xl:grid-cols-12">
                            <PhotoListPanel
                                items={workbench.items}
                                selectedId={selection.selectedId}
                                selectedImportSourceId={selection.selectedImportSourceId}
                                secondaryButtonClass={secondaryButtonClass}
                                onSelect={selection.setSelectedId}
                                onRemove={selection.removeItem}
                                onToggleImportSource={selection.toggleImportSource}
                            />

                            <div className="xl:col-span-9 space-y-5">
                                <Tabs defaultValue="viewer" className="space-y-3">
                                    <TabsList className="grid w-full grid-cols-2">
                                        <TabsTrigger value="viewer">单图查看与修改</TabsTrigger>
                                        <TabsTrigger value="batch">批量处理</TabsTrigger>
                                    </TabsList>

                                    <ViewerTabContent
                                        selectedItem={selection.selectedItem}
                                        selectedGpsPoint={selection.selectedGpsPoint}
                                        selectedFileExtension={selection.selectedFileExtension}
                                        selectedFileNameValue={selection.selectedFileNameValue}
                                        selectedFileNameError={selection.selectedFileNameError}
                                        selectedDateTimeOriginalValue={selection.selectedDateTimeOriginalValue}
                                        selectedDateTimeDigitizedValue={selection.selectedDateTimeDigitizedValue}
                                        singleImportSourceOptions={selection.singleImportSourceOptions}
                                        selectedImportSourceId={selection.selectedImportSourceId}
                                        locationSearchQuery={selection.locationSearchQuery}
                                        mapState={singleFlow.mapState}
                                        copyrightPreset={preferences.copyrightPreset}
                                        copyrightPresetEnabled={preferences.copyrightPresetEnabled}
                                        isCopyrightPresetExpanded={preferences.isCopyrightPresetExpanded}
                                        isExportingSingle={singleFlow.isExportingSingle}
                                        isOverwritingSelected={importFlow.isOverwritingSelected}
                                        isSearchingLocation={singleFlow.isSearchingLocation}
                                        secondaryButtonClass={secondaryButtonClass}
                                        primaryButtonClass={primaryButtonClass}
                                        dangerButtonClass={dangerButtonClass}
                                        dangerSubtleButtonClass={dangerSubtleButtonClass}
                                        importSourceInputRef={importFlow.importSourceInputRef}
                                        mapContainerRef={singleFlow.mapContainerRef}
                                        onExportSelected={() => void singleFlow.exportSelected()}
                                        onOverwriteSelectedInPlace={() => void singleFlow.overwriteSelectedInPlace()}
                                        onSelectedFileNameChange={selection.updateSelectedFileName}
                                        onSelectedDateTimeFieldChange={selection.updateSelectedDateTimeField}
                                        onImportSourceFileChange={importFlow.handleImportSourceFileChange}
                                        onSelectedImportSourceIdChange={selection.setSelectedImportSourceId}
                                        onOpenImportConfirmDialog={() => importFlow.openImportConfirmDialog(false)}
                                        onClearSelectedGps={singleFlow.clearSelectedGps}
                                        onLocationSearchQueryChange={selection.setLocationSearchQuery}
                                        onSearchSelectedLocation={() => void singleFlow.searchSelectedLocation()}
                                        onSelectedGpsFieldChange={selection.updateSelectedGpsField}
                                        onApplyCopyrightPresetToAll={batchFlow.applyCopyrightPresetToAll}
                                        onCopyrightPresetEnabledChange={preferences.setCopyrightPresetEnabled}
                                        onToggleCopyrightPresetExpanded={() => preferences.setIsCopyrightPresetExpanded(!preferences.isCopyrightPresetExpanded)}
                                        onCopyrightPresetFieldChange={preferences.updateCopyrightPresetField}
                                    />

                                    <BatchTabContent
                                        items={workbench.items}
                                        renameRules={batchFlow.renameRules}
                                        renameRuleInputs={batchFlow.renameRuleInputs}
                                        renameFilterKeyword={batchFlow.renameFilterKeyword}
                                        renamePreviewRows={batchFlow.renamePreviewRows}
                                        renameChangedCount={batchFlow.renameChangedCount}
                                        renameApplicableCount={batchFlow.renameApplicableCount}
                                        renameBlockedCount={batchFlow.renameBlockedCount}
                                        batchImportScopeSelection={batchFlow.batchImportScopeSelection}
                                        batchImportSourceId={batchFlow.batchImportSourceId}
                                        batchImportSourceOptions={batchFlow.batchImportSourceOptions}
                                        batchImportTargetItems={batchFlow.batchImportTargetItems}
                                        batchImportWritableTargetItems={batchFlow.batchImportWritableTargetItems}
                                        batchImportSourceItem={batchFlow.batchImportSourceItem}
                                        batchOverwriteEmpty={batchFlow.batchOverwriteEmpty}
                                        batchEditable={batchFlow.batchEditable}
                                        batchGps={batchFlow.batchGps}
                                        batchGpsSourceId={batchFlow.batchGpsSourceId}
                                        gpsSourceOptions={batchFlow.gpsSourceOptions}
                                        batchLocationSearchQuery={batchFlow.batchLocationSearchQuery}
                                        batchMapState={batchFlow.batchMapState}
                                        isSearchingLocation={batchFlow.isSearchingLocation}
                                        isExportingBatch={batchFlow.isExportingBatch}
                                        isOverwritingInPlace={batchFlow.isOverwritingInPlace}
                                        secondaryButtonClass={secondaryButtonClass}
                                        primaryButtonClass={primaryButtonClass}
                                        accentButtonClass={accentButtonClass}
                                        dangerButtonClass={dangerButtonClass}
                                        dangerSubtleButtonClass={dangerSubtleButtonClass}
                                        batchMapContainerRef={batchFlow.batchMapContainerRef}
                                        onSetSelectedAsBatchImportSource={batchFlow.setSelectedAsBatchImportSource}
                                        onBatchImportScopeSelectionChange={batchFlow.setBatchImportScopeSelection}
                                        onBatchImportSourceIdChange={batchFlow.setBatchImportSourceId}
                                        onApplyBatchSourceImport={() => void batchFlow.applyBatchSourceImport(false)}
                                        onRenameRuleInputChange={batchFlow.updateRenameRuleInput}
                                        onSubmitRenameRule={batchFlow.submitRenameRule}
                                        onRemoveRenameRule={batchFlow.removeRenameRule}
                                        onRenameFilterKeywordChange={batchFlow.setRenameFilterKeyword}
                                        onClearRenameRules={batchFlow.clearRenameRules}
                                        onApplyRenameRulesToWorkbench={batchFlow.applyRenameRulesToWorkbench}
                                        onBatchOverwriteEmptyChange={batchFlow.setBatchOverwriteEmpty}
                                        onBatchEditableFieldChange={batchFlow.updateBatchEditableField}
                                        onSyncBatchGpsFromSelected={batchFlow.syncBatchGpsFromSelected}
                                        onClearBatchGpsConfig={batchFlow.clearBatchGpsConfig}
                                        onBatchGpsSourceIdChange={(nextId) => {
                                            batchFlow.setBatchGpsSourceId(nextId);
                                            const sourceItem = workbench.items.find((item) => item.id === nextId);
                                            if (sourceItem) {
                                                batchFlow.setBatchGps({
                                                    ...sourceItem.gpsCurrent,
                                                });
                                            }
                                        }}
                                        onBatchLocationSearchQueryChange={batchFlow.setBatchLocationSearchQuery}
                                        onSearchBatchLocation={() => void batchFlow.searchBatchLocation()}
                                        onBatchGpsFieldChange={batchFlow.updateBatchGpsField}
                                        onApplyBatchChanges={batchFlow.applyBatchChanges}
                                        onResetAllEditable={batchFlow.resetAllEditable}
                                        onExportBatch={() => void batchFlow.exportBatch()}
                                        onOverwriteBatchInPlace={() => void batchFlow.overwriteBatchInPlace()}
                                        onSelectItem={selection.setSelectedId}
                                        onItemFileNameChange={selection.updateItemFileName}
                                        onItemDateTimeFieldChange={selection.updateItemDateTimeField}
                                    />
                                </Tabs>
                            </div>
                        </div>
                    </>
                )}
            </div>
            <ImportConfirmDialog
                open={importFlow.isImportConfirmDialogOpen}
                onOpenChange={importFlow.setIsImportConfirmDialogOpen}
                pendingImportPersistInPlace={importFlow.pendingImportPersistInPlace}
                selectedItem={selection.selectedItem}
                selectedImportSourceItem={selection.selectedImportSourceItem}
                importScopeSelection={importFlow.importScopeSelection}
                setImportScopeSelection={importFlow.setImportScopeSelection}
                importScopeSummaries={importFlow.importScopeSummaries}
                defaultImportScopeSelection={importFlow.defaultImportScopeSelection}
                secondaryButtonClass={secondaryButtonClass}
                accentButtonClass={accentButtonClass}
                dangerButtonClass={dangerButtonClass}
                onConfirm={() => void importFlow.confirmImportSelectedSourceMetadata()}
            />
            <UploadPermissionDialog
                open={importFlow.isUploadPermissionDialogOpen}
                onOpenChange={importFlow.setIsUploadPermissionDialogOpen}
                recentUploadedCount={importFlow.recentUploadedCount}
                secondaryButtonClass={secondaryButtonClass}
                accentButtonClass={accentButtonClass}
                onBindDirectory={() => void importFlow.handleBindUploadedItemsToDirectory()}
            />
        </div>
    );
};

export default PhotoExifWorkbench;
