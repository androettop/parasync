import { Actor, vec } from "excalibur";
import { GAME_CONFIG } from "../config";
import Game from "../engine";
import { createNoteActor, ProcessedNote } from "../helpers/songProcess";

const extraTimeToPassDivider =
  GAME_CONFIG.dividerPosition / GAME_CONFIG.notesSpeed / 1000;

class NotesBatch extends Actor {
  notes: ProcessedNote[];
  batchNumber: number;
  batchTime: number;

  constructor(notes: ProcessedNote[], batchNumber: number) {
    super({
      anchor: vec(0, 1),
      width: GAME_CONFIG.highwayWidth,
      height: GAME_CONFIG.notesBatchSize * GAME_CONFIG.notesSpeed * 1000,
    });

    this.notes = notes;
    this.batchNumber = batchNumber;
    this.batchTime = GAME_CONFIG.notesBatchSize * this.batchNumber;
  }

  public onPreUpdate(engine: Game, elapsed: number): void {
    super.onPreUpdate(engine, elapsed);
    // set batch y position based on the batch time.
    const audioDelay = Number(localStorage.getItem("audio-delay") || 0);

    const notesDelay =
      (GAME_CONFIG.highwayHeight - GAME_CONFIG.dividerPosition) /
        GAME_CONFIG.notesSpeed /
        1000 +
      audioDelay / 1000; // px/s

    const currentTime = (engine.getPlaybackPosition() || 0) + notesDelay;

    const distanceToDivider =
      (currentTime - this.batchTime) * GAME_CONFIG.notesSpeed * 1000;

    const posY =
      GAME_CONFIG.highwayHeight -
      GAME_CONFIG.dividerPosition +
      distanceToDivider;
    this.pos.y = posY;
    this.pos.x = 0;

    if (
      currentTime >
      this.batchTime + GAME_CONFIG.notesBatchSize + extraTimeToPassDivider
    ) {
      this.kill();
    }
  }

  public onInitialize() {
    if (this.notes) {
      this.notes.forEach((note) => {
        this.addChild(createNoteActor(note, this.batchNumber));
      });
    }
  }
}

export default NotesBatch;
