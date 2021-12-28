import { SkeletData, RoomResponse, StartWorkoutPoint, WorkoutProgram } from './models'

export interface WorkoutWorkerDelegate {
  onDidStart(): void;
  onDidDisconnect(): void;
  onDidCompleteExercise(): void;
}

export class WorkoutWorker {
  private socket: WebSocket;
  private endpoint = "wss://forabot.fora.vision";

  public delegate?: WorkoutWorkerDelegate;

  constructor(readonly taskId: number) {
    this.socket = new WebSocket(
      `${this.endpoint}/api/v1/workout/ws/subscribe/${taskId}`
    );
    this.socket.onopen = () => this.delegate?.onDidStart();
    this.socket.onerror = () => this.delegate?.onDidDisconnect();
    this.socket.onclose = () => this.delegate?.onDidDisconnect();

    this.socket.onmessage = (event) => {
      const action = JSON.parse(event.data);
      if (action.type === "NEW_EXERCISE_FOUND") {
        this.delegate?.onDidCompleteExercise();
      }
    };
  }

  sendFrame(skelet: SkeletData) {
    this.socket.send(JSON.stringify(skelet));
  }
}

export class WorkoutApi {
  private session: string = "";
  constructor(private endpoint: string) {}

  public setAuthToken(session: string) {
    this.session = session;
  }

  private async fetch<T = any>(
    input: RequestInfo,
    init: RequestInit = {}
  ): Promise<T> {
    const auth = { Authorization: `Bearer ${this.session}` };
    const res = await fetch(`${this.endpoint}/${input}`, {
      ...init,
      headers: Object.assign(auth, init.headers),
    });

    if (!res.ok) {
      throw Error(res.statusText);
    }

    return await res.json();
  }

  async getProgram(id: number): Promise<WorkoutProgram> {
    const exercises = await this.fetch("api/v1/workout/exercises");
    const program = await this.fetch(`api/v1/workout/${id}/program`);
    return program
  }

  async startWorker(id: number): Promise<StartWorkoutPoint> {
    const existingTask = await this.fetch(`api/v1/workout/${id}/task`).catch(
      () => null
    );
    if (existingTask) {
      return {
        taskId: existingTask.id,
        exercises: existingTask.exercises_num,
      };
    }

    const newTask = await this.fetch(`api/v1/workout/task/${id}/start`);
    return {
      taskId: newTask.task_id,
      exercises: 0,
    };
  }

  async stopWorker(id: number) {
    await this.fetch(`api/v1/workout/task/${id}/stop`);
  }

  async loadRoom(jwt: string): Promise<RoomResponse> {
    return await this.fetch(`api/v1/workout/room?w=${jwt}`);
  }
}
