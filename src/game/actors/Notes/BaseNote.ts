import { Actor, ImageSource, Sprite, vec, Vector } from "excalibur";
import { GAME_CONFIG } from "../../config";
import Game from "../../engine";
import { ProcessedNote } from "../../helpers/songProcess";

class BaseNote extends Actor {
  sprite: Sprite;
  noteTime: number;
  batchNumber: number;

  constructor(
    note: ProcessedNote,
    imageSource: ImageSource,
    batchNumber: number,
    z: number = 10,
  ) {
    super({
      pos: vec(note.posX, 0),
      anchor: Vector.Half,
      z,
      opacity: 1,
    });
    this.noteTime = note.time;
    this.batchNumber = batchNumber;
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

    let opacity = 0;
    if (
      posY >= GAME_CONFIG.dividerPosition &&
      posY <= GAME_CONFIG.highwayHeight - GAME_CONFIG.dividerPosition
    ) {
      opacity = 1;
    } else if (posY > 0 && posY < GAME_CONFIG.dividerPosition) {
      opacity = posY / GAME_CONFIG.dividerPosition;
    } else if (
      posY > GAME_CONFIG.highwayHeight - GAME_CONFIG.dividerPosition &&
      posY < GAME_CONFIG.highwayHeight
    ) {
      opacity =
        1 -
        (posY - (GAME_CONFIG.highwayHeight - GAME_CONFIG.dividerPosition)) /
          GAME_CONFIG.dividerPosition;
    }

    this.graphics.opacity = opacity;
  }

  public onInitialize() {
    this.graphics.use(this.sprite);
    // set position relative to the batch.
    const batchInitTime = GAME_CONFIG.notesBatchSize * this.batchNumber;
    const posY =
      (batchInitTime - this.noteTime) * GAME_CONFIG.notesSpeed * 1000;
    this.pos.y = posY;
  }
}

export default BaseNote;
