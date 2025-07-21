declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

// File System Access API types
interface FileSystemHandle {
  readonly kind: "file" | "directory";
  readonly name: string;
  queryPermission(descriptor?: {
    mode?: "read" | "readwrite";
  }): Promise<"granted" | "denied" | "prompt">;
  requestPermission(descriptor?: {
    mode?: "read" | "readwrite";
  }): Promise<"granted" | "denied" | "prompt">;
}

interface FileSystemFileHandle extends FileSystemHandle {
  readonly kind: "file";
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  readonly kind: "directory";
  entries(): AsyncIterableIterator<
    [string, FileSystemFileHandle | FileSystemDirectoryHandle]
  >;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileSystemFileHandle>;
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileSystemDirectoryHandle>;
  values(): AsyncIterableIterator<
    FileSystemFileHandle | FileSystemDirectoryHandle
  >;
}

interface DirectoryPickerOptions {
  mode?: "read" | "readwrite";
  startIn?:
    | "desktop"
    | "documents"
    | "downloads"
    | "music"
    | "pictures"
    | "videos";
}
//window.__TAURI_INTERNALS__
interface Window {
  __TAURI_INTERNALS__: {
    invoke: (cmd: string, args?: any[]) => Promise<any>;
    event: (event: string, listener: (data: any) => void) => void;
  };
  showDirectoryPicker(
    options?: DirectoryPickerOptions,
  ): Promise<FileSystemDirectoryHandle>;
}
