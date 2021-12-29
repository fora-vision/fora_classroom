export type SkeletData = {
    x: number;
    y: number;
    z: number;
    p: number;
}[]

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
  body_part: string;
  program: {
    sets: WorkoutSet[];
  };
}

export interface StartWorkoutPoint {
  taskId: number;
  exercises: number;
}

export interface RoomResponse {
  workout: WorkoutModel;
  session: string;
}
