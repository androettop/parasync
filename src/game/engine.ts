import {
  Color,
  DisplayMode,
  Engine,
  ImageSource,
  ScrollPreventionMode,
  Sound,
} from "excalibur";
import { ParadiddleSong } from "../types/songs";
import { GAME_CONFIG } from "./config";
import { applyBlur } from "./helpers/imageEffects";
import { ImageFile, MusicFile } from "./helpers/loaders";
import { createLoader, Resources as NotesResources } from "./resources";
import MainScene from "./scenes/MainScene";
import { releaseFileUrl } from "./helpers/filesLoader";

class Game extends Engine {
  song: ParadiddleSong;
  songDirPath: string;
  songTracks: Sound[] = [];
  drumTracks: Sound[] = [];
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
    return this.songTracks[0].getPlaybackPosition();
  }

  public getDuration() {
    return this.songTracks[0].duration || 1;
  }

  public isPlaying() {
    return this.songTracks[0].isPlaying();
  }

  async initialize() {
    this.songTracks = this.song.audioFileData.songTracks.map(
      (trackName) => new MusicFile(`${this.songDirPath}/${trackName}`),
    );
    this.drumTracks = this.song.audioFileData.drumTracks.map(
      (trackName) => new MusicFile(`${this.songDirPath}/${trackName}`),
    );

    this.cover = new ImageFile(
      `${this.songDirPath}/${this.song.recordingMetadata.coverImagePath}`,
    );

    this.coverBg = await applyBlur(this.cover);
    this.add("main", new MainScene());
    const loader = createLoader(NotesResources);
    loader.addResources(this.songTracks);
    loader.addResources(this.drumTracks);
    loader.addResource(this.cover);
    loader.addResource(this.coverBg);
    this.start(loader);
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
    this.songTracks.forEach((songTrack) => releaseFileUrl(songTrack.path));
    this.drumTracks.forEach((drumTrack) => releaseFileUrl(drumTrack.path));
  }
}

export default Game;
