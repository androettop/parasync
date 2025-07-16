import { Actor, ImageSource, Sprite, Vector } from "excalibur";

class DividerNote extends Actor {
  sprite: Sprite;

  constructor(pos: Vector, imageSource: ImageSource) {
    super({
      pos,
      anchor: Vector.Half,
    });
    this.sprite = Sprite.from(imageSource);
  }

  public onInitialize() {
    this.graphics.use(this.sprite);
  }
}

export default DividerNote;
