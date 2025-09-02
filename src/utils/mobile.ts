import { platform } from "@tauri-apps/plugin-os";

export const IS_ANDROID = platform() === "android";
export const topSpacing = IS_ANDROID ? "24px" : "0px";
export const bottomSpacing = IS_ANDROID ? "48px" : "0px";
