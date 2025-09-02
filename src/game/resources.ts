import { ImageSource, ImageWrapping, Loadable } from "excalibur";

import noteCircleCyan from "../assets/NoteCircleCyan.png";
import noteCircleOrange from "../assets/NoteCircleOrange.png";
import noteCirclePurple from "../assets/NoteCirclePurple.png";
import noteCircleYellow from "../assets/NoteCircleYellow.png";
import noteKick from "../assets/NoteKick.png";
import noteBpm from "../assets/NoteBpm.png";
import noteBpmI from "../assets/NoteBpmI.png";
import noteRectBase from "../assets/NoteRectBase.png";
import noteRectCyan from "../assets/NoteRectCyan.png";
import noteRectGreen from "../assets/NoteRectGreen.png";
import noteRectPurple from "../assets/NoteRectPurple.png";
import noteRectRed from "../assets/NoteRectRed.png";

import dividerNoteCircleCyan from "../assets/DividerNoteCircleCyan.png";
import dividerNoteCircleOrange from "../assets/DividerNoteCircleOrange.png";
import dividerNoteCirclePurple from "../assets/DividerNoteCirclePurple.png";
import dividerNoteCircleYellow from "../assets/DividerNoteCircleYellow.png";
import dividerNoteRectBase from "../assets/DividerNoteRectBase.png";
import dividerNoteRectCyan from "../assets/DividerNoteRectCyan.png";
import dividerNoteRectGreen from "../assets/DividerNoteRectGreen.png";
import dividerNoteRectPurple from "../assets/DividerNoteRectPurple.png";
import dividerNoteRectRed from "../assets/DividerNoteRectRed.png";

import divider from "../assets/Divider.png";
import instrumentRailBorder from "../assets/InstrumentRailBorder.png";

import highwayBg from "../assets/HighwayBg.png";

import DrumsBtn from "../assets/DrumsBtn.png";
import DrumsOffBtn from "../assets/DrumsOffBtn.png";
import ExitBtn from "../assets/ExitBtn.png";
import ExitOffBtn from "../assets/ExitOffBtn.png";
import PauseBtn from "../assets/PauseBtn.png";
import PauseOffBtn from "../assets/PauseOffBtn.png";
import PlayBtn from "../assets/PlayBtn.png";
import PlayOffBtn from "../assets/PlayOffBtn.png";
import StartBtn from "../assets/StartBtn.png";
import StopBtn from "../assets/StopBtn.png";
import StopOffBtn from "../assets/StopOffBtn.png";

import ProgressBarEmpty from "../assets/ProgressBarEmpty.png";
import ProgressBarFull from "../assets/ProgressBarFull.png";
import TransparentLoader from "./helpers/transparentLoader";

export const createLoader = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...resourceObjects: Record<string, Loadable<any>>[]
) => {
  const loader = new TransparentLoader();
  for (const resourceObject of resourceObjects) {
    for (const key in resourceObject) {
      loader.addResource(resourceObject[key]);
    }
  }

  return loader;
};

const noteCircleCyanImg = new ImageSource(noteCircleCyan);
const noteCircleOrangeImg = new ImageSource(noteCircleOrange);
const noteCirclePurpleImg = new ImageSource(noteCirclePurple);
const noteCircleYellowImg = new ImageSource(noteCircleYellow);
const noteRectCyanImg = new ImageSource(noteRectCyan);
const noteRectGreenImg = new ImageSource(noteRectGreen);
const noteRectPurpleImg = new ImageSource(noteRectPurple);
const noteRectRedImg = new ImageSource(noteRectRed);
const noteRectBaseImg = new ImageSource(noteRectBase);
const noteKickImg = new ImageSource(noteKick);
const noteBpmImg = new ImageSource(noteBpm);
const noteBpmIImg = new ImageSource(noteBpmI);

const dividerNoteCircleCyanImg = new ImageSource(dividerNoteCircleCyan);
const dividerNoteCircleOrangeImg = new ImageSource(dividerNoteCircleOrange);
const dividerNoteCirclePurpleImg = new ImageSource(dividerNoteCirclePurple);
const dividerNoteCircleYellowImg = new ImageSource(dividerNoteCircleYellow);
const dividerNoteRectCyanImg = new ImageSource(dividerNoteRectCyan);
const dividerNoteRectGreenImg = new ImageSource(dividerNoteRectGreen);
const dividerNoteRectPurpleImg = new ImageSource(dividerNoteRectPurple);
const dividerNoteRectRedImg = new ImageSource(dividerNoteRectRed);
const dividerNoteRectBaseImg = new ImageSource(dividerNoteRectBase);

const dividerImg = new ImageSource(divider);
const instrumentRailBorderImg = new ImageSource(instrumentRailBorder);

const highwayBgImg = new ImageSource(highwayBg);

const DrumsBtnImg = new ImageSource(DrumsBtn);
const DrumsOffBtnImg = new ImageSource(DrumsOffBtn);
const ExitBtnImg = new ImageSource(ExitBtn);
const ExitOffBtnImg = new ImageSource(ExitOffBtn);
const PauseBtnImg = new ImageSource(PauseBtn);
const PauseOffBtnImg = new ImageSource(PauseOffBtn);
const PlayBtnImg = new ImageSource(PlayBtn);
const PlayOffBtnImg = new ImageSource(PlayOffBtn);
const StartBtnImg = new ImageSource(StartBtn);
const StopBtnImg = new ImageSource(StopBtn);
const StopOffBtnImg = new ImageSource(StopOffBtn);

const ProgressBarEmptyImg = new ImageSource(ProgressBarEmpty);
const ProgressBarFullImg = new ImageSource(ProgressBarFull, {
  wrapping: ImageWrapping.Repeat,
});

export const Resources = {
  NoteCircleCyan: noteCircleCyanImg,
  NoteCircleOrange: noteCircleOrangeImg,
  NoteCirclePurple: noteCirclePurpleImg,
  NoteCircleYellow: noteCircleYellowImg,
  NoteRectCyan: noteRectCyanImg,
  NoteRectGreen: noteRectGreenImg,
  NoteRectPurple: noteRectPurpleImg,
  NoteRectRed: noteRectRedImg,
  NoteRectBase: noteRectBaseImg,
  NoteKick: noteKickImg,
  NoteBpm: noteBpmImg,
  NoteBpmI: noteBpmIImg,

  DividerNoteCircleCyan: dividerNoteCircleCyanImg,
  DividerNoteCircleOrange: dividerNoteCircleOrangeImg,
  DividerNoteCirclePurple: dividerNoteCirclePurpleImg,
  DividerNoteCircleYellow: dividerNoteCircleYellowImg,
  DividerNoteRectCyan: dividerNoteRectCyanImg,
  DividerNoteRectGreen: dividerNoteRectGreenImg,
  DividerNoteRectPurple: dividerNoteRectPurpleImg,
  DividerNoteRectRed: dividerNoteRectRedImg,
  DividerNoteRectBase: dividerNoteRectBaseImg,

  Divider: dividerImg,
  InstrumentRailBorder: instrumentRailBorderImg,

  HighwayBg: highwayBgImg,

  DrumsBtn: DrumsBtnImg,
  DrumsOffBtn: DrumsOffBtnImg,
  ExitBtn: ExitBtnImg,
  ExitOffBtn: ExitOffBtnImg,
  PauseBtn: PauseBtnImg,
  PauseOffBtn: PauseOffBtnImg,
  PlayBtn: PlayBtnImg,
  PlayOffBtn: PlayOffBtnImg,
  StartBtn: StartBtnImg,
  StopBtn: StopBtnImg,
  StopOffBtn: StopOffBtnImg,

  ProgressBarEmpty: ProgressBarEmptyImg,
  ProgressBarFull: ProgressBarFullImg,
} as const;
