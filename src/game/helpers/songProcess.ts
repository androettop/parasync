import { Actor, ImageSource, vec } from "excalibur";
import { BPMEventData, EventData } from "../../types/songs";
import BaseNote from "../actors/Notes/BaseNote";
import { GAME_CONFIG } from "../config";
import { Resources } from "../resources";
import DividerNote from "../actors/Notes/DividerNote";
import InstrumentRailBorder from "../actors/InstrumentRailBorder";

export type ProcessedNote = {
  time: number;
  class: string;
  posX: number;
};

export const getBatchNumber = (time: number | string): number => {
  return Math.floor(Number(time) / GAME_CONFIG.notesBatchSize);
};

export const processNotesAndInstruments = (
  events: EventData[],
  bpmEvents: BPMEventData[],
  endTime: number,
) => {
  const notes: Record<number, ProcessedNote[]> = {};

  // Instruments used (bpm does not have its own lane)
  const instruments = GAME_CONFIG.instrumentsOrder.filter((instrument) =>
    events.some((event) => event.name.startsWith(instrument)),
  );

  const centerX = GAME_CONFIG.highwayWidth / 2;

  const computePosX = (instrumentClass: string) => {
    if (["BP_Kick_C", "bpm"].includes(instrumentClass)) return centerX;
    const instrumentIndex = instruments.indexOf(instrumentClass);
    if (instrumentIndex < 0 || instruments.length === 0) return centerX;
    return (
      (GAME_CONFIG.highwayWidth / instruments.length) * instrumentIndex +
      GAME_CONFIG.highwayWidth / (instruments.length * 2)
    );
  };

  const pushNote = (timeNum: number, instrumentClass: string) => {
    const batchNumber = getBatchNumber(timeNum);
    if (!notes[batchNumber]) notes[batchNumber] = [];
    notes[batchNumber].push({
      time: timeNum,
      class: instrumentClass,
      posX: computePosX(instrumentClass),
    });
  };

  // 1) Instrument notes: convert time (string) -> number
  for (const event of events) {
    const t = Number(event.time);
    if (!Number.isFinite(t)) continue; // safety against invalid strings
    const instrumentClass = event.name.substring(
      0,
      event.name.lastIndexOf("_"),
    );
    pushNote(t, instrumentClass);
  }

  // 2) Expand bpmEvents to "bpm" notes (centered, no lane)
  // Simple approach: compute how many beats fit into the section and
  // create all of them except the last one to avoid duplicates at boundaries.
  if (bpmEvents?.length) {
    const sorted = [...bpmEvents].sort((a, b) => a.time - b.time);
    const songEnd = endTime;

    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];

      const sectionStart = Math.max(0, cur.time);
      const sectionEnd = Math.min(songEnd, next ? next.time : songEnd);
      if (sectionEnd <= sectionStart) continue;
      if (cur.bpm <= 0) continue;

      const period = 60 / cur.bpm;
      const length = sectionEnd - sectionStart;

      // total beats that would fit starting at sectionStart (ceiling because
      // a partial last beat still counts as an occurrence at sectionStart + k*period)
      const totalBeats = Math.ceil(length / period);
      const beatsToCreate = Math.max(0, totalBeats - 1); // omit the last

      for (let m = 0; m < beatsToCreate; m++) {
        const t = sectionStart + m * period;
        pushNote(t, "bpm");
      }
    }
  }

  return { notes, instruments };
};

export const createNoteActor = (note: ProcessedNote) => {
  let noteActor: BaseNote | null = null;

  switch (note.class) {
    case "BP_HiHat_C":
      noteActor = new BaseNote(note, Resources.NoteCircleCyan);
      break;
    case "BP_Crash15_C":
      noteActor = new BaseNote(note, Resources.NoteCirclePurple);
      break;
    case "BP_Snare_C":
      noteActor = new BaseNote(note, Resources.NoteRectRed);
      break;
    case "BP_Tom1_C":
      noteActor = new BaseNote(note, Resources.NoteRectCyan);
      break;
    case "BP_Tom2_C":
      noteActor = new BaseNote(note, Resources.NoteRectGreen);
      break;
    case "BP_FloorTom_C":
      noteActor = new BaseNote(note, Resources.NoteRectPurple);
      break;
    case "BP_Crash17_C":
      noteActor = new BaseNote(note, Resources.NoteCircleOrange);
      break;
    case "BP_Ride17_C":
      noteActor = new BaseNote(note, Resources.NoteCircleYellow);
      break;
    case "BP_Kick_C":
      noteActor = new BaseNote(note, Resources.NoteKick, 8);
      break;
    case "bpm":
      noteActor = new BaseNote(note, Resources.NoteBpm, 4);
      break;
    default:
      noteActor = new BaseNote(note, Resources.NoteRectBase);
      break;
  }

  return noteActor;
};

export const createRailBorderActors = (instruments: string[]) => {
  const railActors: Actor[] = [];

  for (let i = 1; i < instruments.length; i++) {
    const posX =
      (GAME_CONFIG.highwayWidth / instruments.length) * i -
      GAME_CONFIG.highwayWidth / 2;
    const pos = vec(
      posX,
      GAME_CONFIG.dividerPosition - GAME_CONFIG.highwayHeight / 2 - 2,
    );
    railActors.push(new InstrumentRailBorder(pos));
  }

  return railActors;
};

export const createDividerNoteActors = (instruments: string[]) => {
  const dividerActors: Actor[] = [];
  instruments.forEach((instrument, index) => {
    if (instrument === "BP_Kick_C") {
      return;
    }

    const posX =
      (GAME_CONFIG.highwayWidth / instruments.length) * index +
      GAME_CONFIG.highwayWidth / (instruments.length * 2) -
      GAME_CONFIG.highwayWidth / 2;

    const pos = vec(posX, -2);
    let dividerImage: ImageSource | null = null;

    switch (instrument) {
      case "BP_HiHat_C":
        dividerImage = Resources.DividerNoteCircleCyan;
        break;
      case "BP_Crash15_C":
        dividerImage = Resources.DividerNoteCirclePurple;
        break;
      case "BP_Snare_C":
        dividerImage = Resources.DividerNoteRectRed;
        break;
      case "BP_Tom1_C":
        dividerImage = Resources.DividerNoteRectCyan;
        break;
      case "BP_Tom2_C":
        dividerImage = Resources.DividerNoteRectGreen;
        break;
      case "BP_FloorTom_C":
        dividerImage = Resources.DividerNoteRectPurple;
        break;
      case "BP_Crash17_C":
        dividerImage = Resources.DividerNoteCircleOrange;
        break;
      case "BP_Ride17_C":
        dividerImage = Resources.DividerNoteCircleYellow;
        break;
      default:
        dividerImage = Resources.DividerNoteRectBase;
        break;
    }
    dividerActors.push(new DividerNote(pos, dividerImage));
  });

  return dividerActors;
};
