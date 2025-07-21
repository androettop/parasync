import {
  Future,
  ImageSource,
  ImageSourceAttributeConstants,
  ImageSourceOptions,
  ImageWrapping,
  Sound,
  TextureLoader,
} from "excalibur";
import { loadFile } from "./filesLoader";

export class MusicFile extends Sound {
  constructor(path: string) {
    super(path);
  }

  async load(): Promise<AudioBuffer> {
    const blobUrl = await loadFile(this.path);
    if (!blobUrl) {
      throw new Error(`Error loading music file ${this.path}`);
    }
    this.path = blobUrl;
    return super.load();
  }
}

export class ImageFile extends ImageSource {
  constructor(path: string, options?: ImageSourceOptions) {
    super(path, options);
  }
  /**
   * Begins loading the image and returns a promise that resolves when the image is loaded
   */
  async load(): Promise<HTMLImageElement> {
    if (this.isLoaded()) {
      return this.data;
    }

    try {
      const url = await loadFile(this.path);
      if (!url) {
        throw new Error(`Error loading music file ${this.path}`);
      }

      // Decode the image
      const image = new Image();
      // Use Image.onload over Image.decode()
      // https://bugs.chromium.org/p/chromium/issues/detail?id=1055828#c7
      // Otherwise chrome will throw still Image.decode() failures for large textures
      const loadedFuture = new Future<void>();
      image.onload = () => loadedFuture.resolve();
      image.src = url;
      image.setAttribute("data-original-src", this.path);

      await loadedFuture.promise;

      // Set results
      // We defer loading the texture into webgl until the first draw that way we avoid a singleton
      // and for the multi-engine case the texture needs to be created in EACH webgl context to work
      // See image-renderer.ts draw()
      this.data = image;

      // emit warning if potentially too big
      TextureLoader.checkImageSizeSupportedAndLog(this.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      throw `Error loading ImageSource from path '${this.path}' with error [${error.message}]`;
    }
    // Do a bad thing to pass the filtering as an attribute
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.data.setAttribute(
      ImageSourceAttributeConstants.Filtering,
      this.filtering as any,
    ); // TODO fix type
    this.data.setAttribute(
      ImageSourceAttributeConstants.WrappingX,
      this.wrapping?.x ?? ImageWrapping.Clamp,
    );
    this.data.setAttribute(
      ImageSourceAttributeConstants.WrappingY,
      this.wrapping?.y ?? ImageWrapping.Clamp,
    );

    return super.load();
  }
}
