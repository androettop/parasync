import {
  Color,
  DisplayMode,
  Engine,
  ImageSource,
  ScrollPreventionMode,
} from "excalibur";
import { ParadiddleSong } from "../types/songs";
import { SongAudioManager } from "../utils/audio";
import { GAME_CONFIG } from "./config";
import { releaseFileUrl } from "./helpers/filesLoader";
import { applyBlur } from "./helpers/imageEffects";
import { ImageFile } from "./helpers/loaders";
import { createLoader, Resources as NotesResources } from "./resources";
import MainScene from "./scenes/MainScene";

class Game extends Engine {
  song: ParadiddleSong;
  songDirPath: string;
  songAudioManager: SongAudioManager | null = null;
  cover: ImageSource | null = null;
  coverBg: ImageSource | null = null;
  exitHandler: () => void;
  releaseFilesTimeout: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    songDirPath: string,
    song: ParadiddleSong,
    onExit: () => void,
  ) {
    super({
      canvasElement: canvas,
      resolution: { height: GAME_CONFIG.height, width: GAME_CONFIG.width },
      backgroundColor: Color.Black,
      suppressConsoleBootMessage: true,
      scrollPreventionMode: ScrollPreventionMode.None,
      displayMode: DisplayMode.FitContainer,
    });

    this.song = song;
    this.songDirPath = songDirPath;
    this.exitHandler = onExit;
  }

  public songPlay() {
    this.songAudioManager?.play();
  }

  public songPause() {
    this.songAudioManager?.pause();
  }

  public songSeek(_progress: number) {
    // TODO: to be implemented, seek in streamings is suuuuuper slow
  }

  public hasDrums() {
    return this.song.audioFileData.drumTracks.length > 0;
  }

  public areDrumsMuted() {
    // TODO: implement this.
    return false;
  }

  public muteDrums() {
    // TODO: implement this.
  }

  public unmuteDrums() {
    // TODO: implemenmt this.
  }

  public getPlaybackPosition() {
    return this.songAudioManager?.position || 0;
  }

  public getDuration() {
    return this.songAudioManager?.duration || 0;
  }

  public isPlaying() {
    return this.songAudioManager?.isPlaying || false;
  }

  async initialize() {
    this.songAudioManager = new SongAudioManager(
      this.song.audioFileData.songTracks.map(
        (trackName) => `${this.songDirPath}/${trackName}`,
      ),
      this.song.audioFileData.drumTracks.map(
        (trackName) => `${this.songDirPath}/${trackName}`,
      ),
      this.song.recordingMetadata.length,
    );

    this.cover = new ImageFile(
      `${this.songDirPath}/${this.song.recordingMetadata.coverImagePath}`,
    );

    this.coverBg = await applyBlur(this.cover);
    this.add("main", new MainScene());
    const loader = createLoader(NotesResources);
    loader.addResource(this.songAudioManager);
    loader.addResource(this.cover);
    loader.addResource(this.coverBg);
    this.start(loader);
  }

  onPreUpdate(_engine: Engine, _delta: number): void {
    // HACK: The data sync between rust/js is very slow, so the delta time is used to estimate the position
    // TODO: implement this this.songTracks?.[0].estimatePosition(delta);
  }

  onInitialize(engine: Engine): void {
    super.onInitialize(engine);
    this.goToScene("main");
    this.setupReleaseFilesInterval();
  }

  private setupReleaseFilesInterval() {
    // Check if the engine is not running and free resources
    setTimeout(() => {
      if (!this.isRunning()) {
        this.releaseResources();
      } else {
        this.setupReleaseFilesInterval();
      }
    }, 500);
  }

  private releaseResources() {
    console.log("Releasing resources...");
    releaseFileUrl(this.cover?.data.src);
    releaseFileUrl(this.coverBg?.data.src);
    this.songAudioManager?.dispose();
  }
}

export default Game;
