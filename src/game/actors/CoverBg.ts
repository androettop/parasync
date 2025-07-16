import { Actor, Sprite, vec, Vector } from "excalibur";
import { GAME_CONFIG } from "../config";
import Game from "../engine";

class CoverBg extends Actor {
  constructor() {
    super({
      pos: vec(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2),
      anchor: Vector.Half,
    });
  }

  public onInitialize(engine: Game) {
    if (engine.coverBg) { 
      this.graphics.use(
        Sprite.from(engine.coverBg)
      );

      // Scale the cover to fit the screen, cover effect.
      
      const largerDimension = Math.max(GAME_CONFIG.width, GAME_CONFIG.height);
      const coverScale = largerDimension / Math.max(
        this.graphics.getGraphic("default")?.width || 1,
        this.graphics.getGraphic("default")?.height || 1
      );

      this.scale = vec(
        coverScale,
        coverScale
      );
    }
  }
}

export default CoverBg;
