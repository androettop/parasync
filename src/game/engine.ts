import { Color, DisplayMode, Engine, ImageSource, ScrollPreventionMode, Sound } from "excalibur";
import { SongData } from "../types/songs";
import { GAME_CONFIG } from "./config";
import { applyBlur } from "./helpers/imageEffects";
import { ImageFile, MusicFile } from "./helpers/loaders";
import { createLoader, Resources as NotesResources } from "./resources";
import MainScene from "./scenes/MainScene";

class Game extends Engine {
  song: SongData;
  songTracks: Sound[] = [];
  drumTracks: Sound[] = [];
  cover: ImageSource | null = null;
  coverBg: ImageSource | null = null;
  exitHandler: () => void;

  constructor(canvas: HTMLCanvasElement, song: SongData, onExit: () => void) {
    super({
      canvasElement: canvas,
      resolution: { height: GAME_CONFIG.height, width: GAME_CONFIG.width },
      backgroundColor: Color.Black,
      suppressConsoleBootMessage: true,
      scrollPreventionMode: ScrollPreventionMode.None,
      displayMode: DisplayMode.FitContainer,
    });

    this.song = song;
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
      (trackName) => new MusicFile(this.song, trackName)
    );
    this.drumTracks = this.song.audioFileData.drumTracks.map(
      (trackName) => new MusicFile(this.song, trackName)
    );

    this.cover = new ImageFile(
      this.song,
      this.song.recordingMetadata.coverImagePath
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
  }
}

export default Game;
