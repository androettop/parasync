import { Actor, Sprite, Vector } from "excalibur";
import { Resources } from "../resources";

class InstrumentRailBorder extends Actor {
  constructor(pos: Vector) {
    super({
      pos,
      anchor: Vector.Half,
      z: -1,
    });
  }

  public onInitialize() {
    this.graphics.use(Sprite.from(Resources.InstrumentRailBorder));
  }
}

export default InstrumentRailBorder;
