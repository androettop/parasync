import {
  Actor,
  Handler,
  ImageSource,
  PointerEvent,
  Sprite,
  Vector,
} from "excalibur";

class Button extends Actor {
  imageSource: ImageSource;
  disabledImageSource?: ImageSource;
  onPress: Handler<PointerEvent>;
  disabled: () => boolean;
  currentState: "enabled" | "disabled" = "enabled";

  constructor(
    pos: Vector,
    enabledImage: ImageSource,
    onPress: Handler<PointerEvent>,
    disabledImage?: ImageSource,
    disabled: () => boolean = () => false
  ) {
    super({
      pos,
      anchor: Vector.Half,
      z: 30,
    });
    this.onPress = onPress;
    this.imageSource = enabledImage;
    this.disabledImageSource = disabledImage;
    this.disabled = disabled;
    this.currentState = disabled() ? "disabled" : "enabled";
  }

  public onPostUpdate() {
    if (!this.disabledImageSource || !this.imageSource) {
      return;
    }

    const isDisabled = this.disabled();

    if (this.currentState === "disabled" && !isDisabled) {
      this.currentState = "enabled";
      this.graphics.use(Sprite.from(this.imageSource));
    } else if (this.currentState === "enabled" && isDisabled) {
      this.currentState = "disabled";
      this.graphics.use(Sprite.from(this.disabledImageSource));
    }
  }

  public onInitialize() {
    const isDisabled = this.disabled();

    if (isDisabled && this.disabledImageSource) {
      this.graphics.use(Sprite.from(this.disabledImageSource));
    } else {
      this.graphics.use(Sprite.from(this.imageSource));
    }
    this.on("pointerup", (e) => {
      if (this.disabled()) {
        return;
      } else {
        this.onPress(e);
      }
    });
  }
}

export default Button;
