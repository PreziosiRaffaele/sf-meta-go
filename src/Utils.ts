export function isStandardField(apiName: string): boolean {
  return !apiName.endsWith('__c');
}

export function isStandardObject(apiName: string): boolean {
  return !(apiName.endsWith('__c') || isCustomMetadata(apiName) || isPlatformEvent(apiName));
}

export function isCustomMetadata(apiName: string): boolean {
  return apiName.endsWith('__mdt');
}

export function isPlatformEvent(apiName: string): boolean {
  return apiName.endsWith('__e');
}

export function getObjectFieldDeveloperName(fileName: string): string {
  const fieldSplitted = fileName.split('__');
  if (fieldSplitted.length > 2) {
    return fieldSplitted[1];
  } else {
    return fieldSplitted[0];
  }
}

export function isWindows(): boolean {
  return process.platform === 'win32';
}
