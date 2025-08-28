import { Actor, ImageSource, Sprite, vec, Vector } from "excalibur";
import { GAME_CONFIG } from "../../config";
import Game from "../../engine";
import { ProcessedNote } from "../../helpers/songProcess";

class BaseNote extends Actor {
  sprite: Sprite;
  noteTime: number;

  constructor(note: ProcessedNote, imageSource: ImageSource, z: number = 10) {
    super({
      pos: vec(note.posX, -1000),
      anchor: Vector.Half,
      z,
      opacity: 1,
    });
    this.noteTime = note.time;
    this.sprite = Sprite.from(imageSource);
  }

  public onPostUpdate(engine: Game, elapsed: number): void {
    super.onPostUpdate(engine, elapsed);

    const audioDelay = Number(localStorage.getItem("audio-delay") || 0);

    const notesDelay =
      (GAME_CONFIG.highwayHeight - GAME_CONFIG.dividerPosition) /
        GAME_CONFIG.notesSpeed /
        1000 +
      audioDelay / 1000; // px/s

    const currentTime = (engine.getPlaybackPosition() || 0) + notesDelay;

    const distanceToDivider =
      (currentTime - this.noteTime) * GAME_CONFIG.notesSpeed * 1000;

    const posY =
      GAME_CONFIG.highwayHeight -
      GAME_CONFIG.dividerPosition +
      distanceToDivider;
    this.pos.y = posY;

    if (this.pos.y > GAME_CONFIG.highwayHeight) {
      this.kill();
    }

    let opacity = 0;
    if (
      this.pos.y >= GAME_CONFIG.dividerPosition &&
      this.pos.y <= GAME_CONFIG.highwayHeight - GAME_CONFIG.dividerPosition
    ) {
      opacity = 0.98;
    } else if (this.pos.y > 0 && this.pos.y < GAME_CONFIG.dividerPosition) {
      opacity = this.pos.y / GAME_CONFIG.dividerPosition;
    } else if (
      this.pos.y > GAME_CONFIG.highwayHeight - GAME_CONFIG.dividerPosition &&
      this.pos.y < GAME_CONFIG.highwayHeight
    ) {
      opacity =
        1 -
        (this.pos.y -
          (GAME_CONFIG.highwayHeight - GAME_CONFIG.dividerPosition)) /
          GAME_CONFIG.dividerPosition;
    }

    this.graphics.opacity = opacity;
  }

  public onInitialize() {
    this.graphics.use(this.sprite);
  }
}

export default BaseNote;
