import {
  SkeletData,
  RoomResponse,
  StartWorkoutPoint,
  WorkoutModel,
  Exercise,
} from "./models";

export interface WorkoutWorkerDelegate {
  onDidStart(worker: WorkoutWorker): void;
  onDidDisconnect(worker: WorkoutWorker): void;
  onDidCompleteExercise(worker: WorkoutWorker): void;
}

export class WorkoutWorker {
  private socket: WebSocket;
  private endpoint = "wss://dev.fora.vision";
  private isStarted = false

  public delegate?: WorkoutWorkerDelegate;

  constructor(readonly taskId: number) {
    this.socket = new WebSocket(
      `${this.endpoint}/api/v1/workout/ws/subscribe/${taskId}`
    );

    this.socket.onopen = () => {
      this.isStarted = true;
      this.delegate?.onDidStart(this);
    }

    this.socket.onerror = (err) => {
      console.log(err)
      this.isStarted = false;
      this.delegate?.onDidDisconnect(this);
    }

    this.socket.onclose = (err) => {
      console.log(err)
      this.isStarted = false;
      this.delegate?.onDidDisconnect(this);
    }

    this.socket.onmessage = (event) => {
      const action = JSON.parse(event.data);
      if (action.type === "NEW_EXERCISE_FOUND") {
        this.delegate?.onDidCompleteExercise(this);
      }
    };
  }

  nextExercise(id: string) {
    const event = { type: "NEXT_EXERCISE", data: id };
    this.socket.send(JSON.stringify(event));
  }

  sendFrame(skelet: SkeletData) {
    if (!this.isStarted) return;
    const event = { type: "NEW_FRAME_DATA", data: skelet };  
    this.socket.send(JSON.stringify(event));
  }
}

export class WorkoutApi {
  private session: string = "";
  private endpoint = "https://dev.fora.vision";

  public setAuthToken(session: string) {
    this.session = session;
  }

  private async fetch<T = any>(
    input: RequestInfo,
    init: RequestInit = {}
  ): Promise<T> {
    const auth = { Authorization: this.session };
    const res = await fetch(`${this.endpoint}/${input}`, {
      ...init,
      headers: Object.assign(auth, init.headers),
    });

    if (!res.ok) {
      throw Error(res.statusText);
    }

    return await res.json();
  }

  async getExercises(id: number): Promise<Record<string, Exercise>> {
    const res = await this.fetch("api/v1/workout/exercises");
    return res.exercises;
  }

  async startWorker(id: number): Promise<StartWorkoutPoint> {
    const existingTask = await this.fetch(`api/v1/workout/${id}/task`).catch(
      () => null
    );

    if (existingTask && existingTask.status === 6) {
      return {
        taskId: existingTask.id,
        exercises: existingTask.exercises_num,
      };
    }

    const newTask = await this.fetch(`api/v1/workout/task/${id}/start`, { method: "POST" });
    return {
      taskId: newTask.task_id,
      exercises: 0,
    };
  }

  async stopWorker(id: number) {
    await this.fetch(`api/v1/workout/task/${id}/stop`, { method: "POST" });
  }

  async loadRoom(jwt: string): Promise<RoomResponse> {
    return await this.fetch(`api/v1/workout/room?w=${jwt}`);
  }
}
