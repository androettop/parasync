import { platform } from "@tauri-apps/plugin-os";

export const topSpacing = platform() === "android" ? "24px" : "0px";
export const bottomSpacing = platform() === "android" ? "48px" : "0px";
