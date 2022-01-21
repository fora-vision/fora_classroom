import { SkeletData, RoomResponse, Exercise } from "./models";

export enum WorkoutDisconnectStatus {
  Success = 1000,
  AlreadyCompleted = 3002,
  AlreadyStarted = 3003,
  NoFreeWorkers = 3005,
  Error = 0,
}

export const watchConfirmRequest = (invite: string) =>
  new Promise<string>((resolve, reject) => {
    const socket = new WebSocket(`wss://dev.fora.vision/api/v2/workout/room/${invite}`);
    socket.onerror = () => reject();
    socket.onclose = () => reject();
    socket.onmessage = (event) => {
      const action = JSON.parse(event.data);
      if (action.w) {
        resolve(action.w);
        socket.close();
      }
    };
  });

export interface WorkoutWorkerDelegate {
  onDidStart(worker: WorkoutWorker): void;
  onDidCompleteExercise(worker: WorkoutWorker): void;
  onDidDisconnect(worker: WorkoutWorker, status: WorkoutDisconnectStatus): void;
  onDidReplaceExercise(worker: WorkoutWorker, exercise: string, count: number, position: number): void;
  onDidNextExercise(worker: WorkoutWorker, exercise: string, count: number, position: number): void;
}

export class WorkoutWorker {
  private socket: WebSocket;
  private endpoint = "wss://dev.fora.vision";
  private isStarted = false;

  public delegate?: WorkoutWorkerDelegate;

  constructor(readonly workoutId: number) {
    this.socket = new WebSocket(`${this.endpoint}/api/v2/workout/ws/recognizer/${workoutId}`);

    this.socket.onopen = () => {
      this.isStarted = true;
      this.delegate?.onDidStart(this);
    };

    this.socket.onerror = (err) => {
      console.log(err);
      this.isStarted = false;
      this.delegate?.onDidDisconnect(this, WorkoutDisconnectStatus.Error);
    };

    this.socket.onclose = (err) => {
      console.log(err);
      this.isStarted = false;
      this.delegate?.onDidDisconnect(this, err.code);
    };

    this.socket.onmessage = (event) => {
      const action = JSON.parse(event.data);

      if (action.type === "NEW_REPEAT_FOUND") {
        this.delegate?.onDidCompleteExercise(this);
      }

      if (action.type === "NEXT_EXERCISE") {
        this.delegate?.onDidNextExercise(this, action.label, action.count, action.exercise_num);
      }

      if (action.type === "REPLACE_EXERCISE") {
        this.delegate?.onDidReplaceExercise(this, action.label, action.count, action.exercise_num);
      }
    };
  }

  replaceExercise() {
    if (!this.isStarted) return;
    this.socket.send(JSON.stringify({ type: "REPLACE_EXERCISE" }));
  }

  sendFrame(points: SkeletData) {
    if (!this.isStarted) return;
    this.socket.send(
      JSON.stringify({
        type: "FRAME",
        data: points,
      })
    );
  }
}

export class WorkoutApi {
  private session: string = "";
  private endpoint = "https://dev.fora.vision";

  public setAuthToken(session: string) {
    this.session = session;
  }

  private async fetch<T = any>(input: RequestInfo, init: RequestInit = {}): Promise<T> {
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

  async loadRoom(jwt: string): Promise<RoomResponse> {
    return await this.fetch(`api/v2/workout/room?w=${jwt}`);
  }
}
