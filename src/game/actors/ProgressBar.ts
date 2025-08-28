import { Actor, Sprite, vec } from "excalibur";
import { GAME_CONFIG } from "../config";
import Game from "../engine";
import { Resources } from "../resources";

class ProgressBar extends Actor {
  progressBarActor: Actor | null = null;

  constructor() {
    super({
      pos: vec(GAME_CONFIG.width / 2, GAME_CONFIG.highwayHeight + 10),
      anchor: vec(0.5, 0),
      z: 30,
    });
  }

  public onPostUpdate(engine: Game, elapsed: number): void {
    super.onPostUpdate(engine, elapsed);

    if (!this.progressBarActor) {
      return;
    }

    const currentTime = engine.getPlaybackPosition();
    const progress = Math.min(currentTime / engine.getDuration(), 1);

    // TODO: fix the image distortion
    this.progressBarActor.scale.x = progress;
  }

  // private getRelativeX(x: number) {
  //   return x - (GAME_CONFIG.width - GAME_CONFIG.highwayWidth) / 2;
  // }

  public onInitialize(_engine: Game) {
    this.graphics.use(Sprite.from(Resources.ProgressBarEmpty));
    this.progressBarActor = new Actor({
      pos: vec(-GAME_CONFIG.highwayWidth / 2, 0),
      anchor: vec(0, 0),
    });
    this.progressBarActor.graphics.use(Sprite.from(Resources.ProgressBarFull));

    this.addChild(this.progressBarActor);

    // TODO: enable seek when it's faster
    // this.on("pointerdown", (event) => {
    //   const posX = this.getRelativeX(event.screenPos.x);
    //   const progress = Math.min(posX / GAME_CONFIG.highwayWidth, 1);
    //   engine.songPause();
    //   engine.songSeek(progress);
    // });

    // this.on("pointerdragmove", (event) => {
    //   const posX = this.getRelativeX(event.screenPos.x);
    //   const progress = Math.min(posX / GAME_CONFIG.highwayWidth, 1);
    //   engine.songSeek(progress);
    // });

    // this.on("pointerup", () => {
    //   engine.songPlay();
    // });
  }
}

export default ProgressBar;
