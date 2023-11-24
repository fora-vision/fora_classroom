export const initializeError = {
  title: "Не получилось запустить тренировку!",
  description: "Такой тренировки не существует или отсутствует соединение с сервером",
};

export enum WorkoutState {
  Invite,
  Loading,
  InitializeFailed,
  Running,
  Error,
  Complete,
}

export type SkeletData = {
  x: number;
  y: number;
  z: number;
  p: number;
}[];

export interface WorkoutBatch {
  total_time: number;
  frame: { height: number; width: number; horizontal: boolean };
  exercises: { frame_id: number; label: string }[];
  frames: SkeletData[];
  proof?: string;
}

export interface Exercise {
  label: string;
  name: string;
  description: string;
  video_url: string;
  image_up: string;
  image_down: string;
  count: number;
  side: "left" | "front" | "right";
}

export enum WorkoutStatus {}

export interface WorkoutSet {
  name: string;
  repeats: number;
  exercises: {
    count: number;
    label: string;
  }[];
}

export interface WorkoutModel {
  id: number;
  mark: number;
  duration: number;
  calories: number;
  name: string;
  status: WorkoutStatus;
  exercises_num: number;
  model_version: string;
  frame_id: number;
  body_part: string;
  save_photos: boolean;
  program: {
    sets: WorkoutSet[];
  };
}

export interface RoomResponse {
  user_id: number;
  workout: WorkoutModel;
  session: string;
}
