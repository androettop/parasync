import { ImageSource, Scene, Sprite, vec } from "excalibur";
import Button from "../actors/Button";
import CoverBg from "../actors/CoverBg";
import Highway from "../actors/Highway";
import ProgressBar from "../actors/ProgressBar";
import { GAME_CONFIG } from "../config";
import Game from "../engine";
import { processNotesAndInstruments } from "../helpers/songProcess";
import { Resources } from "../resources";

class MainScene extends Scene {
  counter: number = 0;
  sprites: Record<string, ImageSource> = {};
  startBtn: Button | null = null;

  public startSong(engine: Game) {
    // start all tracks
    engine.songPlay();
  }

  public onPostUpdate(engine: Game): void {
    if (!this.startBtn) {
      return;
    }

    const musicStopped =
      !engine.isPlaying() && engine.getPlaybackPosition() === 0;

    // if the song is playing, remove the start button
    if (musicStopped && !this.actors.includes(this.startBtn)) {
      this.add(this.startBtn);
    } else if (!musicStopped && this.actors.includes(this.startBtn)) {
      this.remove(this.startBtn);
    }
  }

  /**
   * Each time the scene is entered (Engine.goToScene)
   */
  public onActivate() {
    const engine = this.engine as Game;

    // Add cover bg
    this.add(new CoverBg());

    // process notes to make it easier to use
    const { notes, instruments } = processNotesAndInstruments(
      engine.song.events,
    );

    // Add the Highway
    this.add(new Highway(notes, instruments));

    // Create the Start Button
    this.startBtn = new Button(
      vec(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2),
      Resources.StartBtn,
      () => this.startSong(engine),
    );

    // Create the progress bar
    this.add(new ProgressBar());

    const buttonWidth = 90;

    // Position of the first button
    const firstButtonPos = vec(
      (GAME_CONFIG.width - GAME_CONFIG.highwayWidth) / 2 + buttonWidth / 2,
      GAME_CONFIG.highwayHeight + 60,
    );

    // Create play button
    this.add(
      new Button(
        firstButtonPos,
        Resources.PlayBtn,
        () => engine.songPlay(),
        Resources.PlayOffBtn,
        () => engine.isPlaying(),
      ),
    );

    // Create pause button
    this.add(
      new Button(
        firstButtonPos.add(vec(buttonWidth, 0)),
        Resources.PauseBtn,
        () => engine.songPause(),
        Resources.PauseOffBtn,
        () => !engine.isPlaying(),
      ),
    );

    // Create drums button
    const drumsBtn = new Button(
      firstButtonPos.add(vec(buttonWidth * 3, 0)),
      engine.hasDrums() && !engine.areDrumsMuted()
        ? Resources.DrumsBtn
        : Resources.DrumsOffBtn,
      () => {
        if (!engine.hasDrums()) {
          return;
        }

        if (!engine.areDrumsMuted()) {
          drumsBtn.graphics.use(Sprite.from(Resources.DrumsOffBtn));
          engine.muteDrums();
        } else {
          drumsBtn.graphics.use(Sprite.from(Resources.DrumsBtn));
          engine.unmuteDrums();
        }
      },
    );
    this.add(drumsBtn);

    // Create stop button
    this.add(
      new Button(
        firstButtonPos.add(vec(buttonWidth * 2, 0)),
        Resources.StopBtn,
        () => {
          engine.songStop();
          drumsBtn.graphics.use(Sprite.from(Resources.DrumsBtn));
        },
        Resources.StopOffBtn,
        () => engine.getPlaybackPosition() === 0 && !engine.isPlaying(),
      ),
    );

    // exit button
    this.add(
      new Button(
        firstButtonPos.add(vec(buttonWidth * 4, 0)),
        Resources.ExitBtn,
        () => {
          engine.songPause();
          engine.exitHandler();
        },
      ),
    );
  }
}

export default MainScene;
