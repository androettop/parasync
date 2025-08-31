import { DefaultLoader, Engine } from "excalibur";

export default class TransparentLoader extends DefaultLoader {
  private _totalTime = 0;

  /**
   * Optionally override the onUpdate
   * @param engine
   * @param elapsed
   */
  onUpdate(_engine: Engine, elapsed: number): void {
    this._totalTime += elapsed;
    // override me
  }

  /**
   * Optionally override the onDraw
   */
  onDraw(ctx: CanvasRenderingContext2D) {
    const seconds = this._totalTime / 1000;

    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.fillRect(
      0,
      0,
      this.engine.screen.resolution.width,
      this.engine.screen.resolution.height,
    );

    ctx.save();
    ctx.translate(
      this.engine.screen.resolution.width / 2,
      this.engine.screen.resolution.height / 2,
    );
    const speed = seconds * 10;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.arc(0, 0, 40, speed, speed + (Math.PI * 3) / 2);
    ctx.stroke();

    ctx.fillStyle = "white";
    ctx.font = "16px sans-serif";
    const text = (this.progress * 100).toFixed(0) + "%";
    const textbox = ctx.measureText(text);
    const width =
      Math.abs(textbox.actualBoundingBoxLeft) +
      Math.abs(textbox.actualBoundingBoxRight);
    const height =
      Math.abs(textbox.actualBoundingBoxAscent) +
      Math.abs(textbox.actualBoundingBoxDescent);
    ctx.fillText(text, -width / 2, height / 2); // center
    ctx.restore();
  }
}
