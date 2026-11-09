let pendingImport = null;

export function setPendingPhotoImport(area, entries) {
  pendingImport = { area, entries };
}

export function consumePendingPhotoImport(area) {
  if (!pendingImport || pendingImport.area !== area) return null;
  const value = pendingImport.entries;
  pendingImport = null;
  return value;
}
