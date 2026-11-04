export interface DashboardCounts {
  validScanCount: number;
  invalidScanCount: number;
  totalPartsCount: number;
  holdPartsCount: number;
  pickedPartsCount: number;
  availablePartsCount: number;
  // HU stats
  totalHUs: number;
  inKardexHUs: number;
  emptyHUs: number;
  partialHUs: number;
  fullHUs: number;
  draftHUs: number;
}
