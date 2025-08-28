import {
  Color,
  DisplayMode,
  Engine,
  ImageSource,
  ScrollPreventionMode
} from "excalibur";
import { ParadiddleSong } from "../types/songs";
import { RustAudio } from "../utils/audio";
import { GAME_CONFIG } from "./config";
import { releaseFileUrl } from "./helpers/filesLoader";
import { applyBlur } from "./helpers/imageEffects";
import { ImageFile } from "./helpers/loaders";
import { createLoader, Resources as NotesResources } from "./resources";
import MainScene from "./scenes/MainScene";

class Game extends Engine {
  song: ParadiddleSong;
  songDirPath: string;
  songTracks: RustAudio[] = [];
  drumTracks: RustAudio[] = [];
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
    [...this.songTracks, ...this.drumTracks].forEach((track) => {
      track.play();
    });
  }

  public songPause() {
    [...this.songTracks, ...this.drumTracks].forEach((track) => {
      track.pause();
    });
  }

  public songSeek(progress: number) {
    [...this.songTracks, ...this.drumTracks].forEach((track) => {
      track.seek(progress * (track.duration || 0));
    });
  }

  public hasDrums() {
    return this.drumTracks.length > 0;
  }

  public areDrumsMuted() {
    return this.drumTracks?.[0]?.volume === 0;
  }

  public muteDrums() {
    this.drumTracks.forEach((track) => (track.volume = 0));
  }

  public unmuteDrums() {
    this.drumTracks.forEach((track) => (track.volume = 1));
  }

  public getPlaybackPosition() {
    return this.songTracks[0].position;
  }

  public getDuration() {
    return this.songTracks[0].duration || 1;
  }

  public isPlaying() {
    return this.songTracks[0].playing;
  }

  async initialize() {
    this.songTracks = await Promise.all(this.song.audioFileData.songTracks.map(
      async (trackName) => RustAudio.load(`${this.songDirPath}/${trackName}`),
    ));
    this.drumTracks = await Promise.all(this.song.audioFileData.drumTracks.map(
      async (trackName) => RustAudio.load(`${this.songDirPath}/${trackName}`),
    ));

    this.cover = new ImageFile(
      `${this.songDirPath}/${this.song.recordingMetadata.coverImagePath}`,
    );

    this.coverBg = await applyBlur(this.cover);
    this.add("main", new MainScene());
    const loader = createLoader(NotesResources);
    loader.addResource(this.cover);
    loader.addResource(this.coverBg);
    this.start(loader);
  }

  onPreUpdate(_engine: Engine, delta: number): void {
    // HACK: The data sync between rust/js is very slow, so the delta time is used to estimate the position
    this.songTracks.forEach((songTrack) => songTrack.estimatePosition(delta/1000));
    this.drumTracks.forEach((drumTrack) => drumTrack.estimatePosition(delta/1000));
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
    }, 2000);
  }

  private releaseResources() {
    console.log("Releasing resources...");
    releaseFileUrl(this.cover?.data.src);
    releaseFileUrl(this.coverBg?.data.src);
    this.songTracks.forEach((songTrack) => songTrack.unload());
    this.drumTracks.forEach((drumTrack) => drumTrack.unload());
  }
}

export default Game;
