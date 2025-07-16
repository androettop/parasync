import { Actor, Sprite, vec, Vector } from "excalibur";
import { GAME_CONFIG } from "../config";
import {
  createDividerNoteActors,
  createRailBorderActors,
} from "../helpers/songProcess";
import { Resources } from "../resources";

class Divider extends Actor {
  instruments: string[];

  constructor(instruments: string[]) {
    super({
      pos: vec(
        GAME_CONFIG.highwayWidth / 2,
        GAME_CONFIG.highwayHeight - GAME_CONFIG.dividerPosition
      ),
      anchor: Vector.Half,
      z: 5,
    });

    this.instruments = instruments;
  }

  public onInitialize() {
    this.graphics.use(Sprite.from(Resources.Divider));

    // put the divider note for each instrument
    const dividerNoteActors = createDividerNoteActors(this.instruments);
    dividerNoteActors.forEach((actor) => {
      this.addChild(actor);
    });

    const instrumentRailActors = createRailBorderActors(this.instruments);
    instrumentRailActors.forEach((actor) => {
      this.addChild(actor);
    });
  }
}

export default Divider;
