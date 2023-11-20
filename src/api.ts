import { RoomResponse, Exercise, WorkoutBatch } from "./types";

export class WorkoutApi {
  public readonly endpoint = "https://dev.fora.vision";
  constructor(public readonly jwt = "") {}

  private async fetch<T = any>(input: RequestInfo, init: RequestInit = {}): Promise<T> {
    const auth = { authorization: this.jwt };
    const res = await fetch(`${this.endpoint}/${input}`, {
      ...init,
      headers: Object.assign(auth, init.headers),
    });

    if (!res.ok) {
      throw Error(res.statusText);
    }

    return await res.json();
  }

  async replaceExercise(): Promise<{ exercise: string; count: number }> {
    const res = await this.fetch("api/v2/workout/room/update", { method: "POST" });
    return await res.json();
  }

  async getExercises(): Promise<Record<string, Exercise>> {
    const res = await this.fetch("api/v1/workout/exercises");
    return res.exercises;
  }

  async uploadPhoto(workout: number, frame: number, photo: Blob): Promise<void> {
    const formData = new FormData();
    formData.append("file", photo);

    await this.fetch(`api/v2/workout/${workout}/screenshot/${frame}`, {
      method: "POST",
      body: formData,
    });
  }

  async batchWorkout(batch: WorkoutBatch) {
    return await this.fetch(`api/v2/workout/room/exercises`, {
      body: JSON.stringify(batch),
      method: "POST",
    });
  }

  async stopWorkout() {
    return await this.fetch(`api/v2/workout/room/stop`, {
      method: "POST",
    });
  }

  async loadRoom(jwt: string): Promise<RoomResponse> {
    return await this.fetch(`api/v2/workout/room?w=${jwt}`);
  }
}
