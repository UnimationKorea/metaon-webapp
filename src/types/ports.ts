export type StoredPackageFile = {
  packageKey: string;
  path: string;
  blob: Blob;
  size: number;
  mimeType: string;
};

export type StoragePort = {
  getPackage: (packageKey: string) => Promise<import("./metaonTypes").BookPackage | undefined>;
  savePackage: (
    packageMeta: import("./metaonTypes").BookPackage,
    files: StoredPackageFile[]
  ) => Promise<void>;
  listPackages: () => Promise<import("./metaonTypes").BookPackage[]>;
  listFiles: (packageKey: string) => Promise<StoredPackageFile[]>;
  getFileBlob: (packageKey: string, path: string) => Promise<Blob | undefined>;
  deletePackage: (packageKey: string) => Promise<void>;
};

export type MediaPort = {
  playAudioUrl: (url: string) => Promise<void>;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
};

export type RecorderPort = {
  requestPermission: () => Promise<boolean>;
  start: () => Promise<void>;
  stop: () => Promise<Blob | undefined>;
  isRecording: () => boolean;
};

export type RecognitionPort = {
  recognizeSpeech: (audio: Blob, expectedText?: string) => Promise<unknown>;
  recognizeHandwriting: (image: Blob) => Promise<unknown>;
};
