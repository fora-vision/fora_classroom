import { action, makeObservable, observable, runInAction } from "mobx";
import {
  WorkoutWorker,
  WorkoutApi,
  WorkoutWorkerDelegate,
  WorkoutDisconnectStatus, watchConfirmRequest,
} from "./api";
import { Exercise, SkeletData, WorkoutModel } from "./models";
import { ExerciseState, QueueExercises } from "./queue";

export enum WorkoutState {
  Invite,
  Loading,
  InitializeFailed,
  Running,
  Hint,
  Error,
  Complete,
}

const initializeError = {
  title: "Не получилось запустить тренировку!",
  description: "Такой тренировки не существует или отсутствует соединение с сервером"
}

const errorMessages = {
  [WorkoutDisconnectStatus.AlreadyCompleted]: {
    title: "Тренировка уже завершена",
    description: "Вы уже выполнили эту тренировку, можете гордиться собой!",
  },

  [WorkoutDisconnectStatus.AlreadyStarted]: {
    title: "Тренировка уже запущена",
    description: "Проверьте, возможно вы открыли ее в соседнем окне.",
  },

  [WorkoutDisconnectStatus.NoFreeWorkers]: {
    title: "Нет свободных ресурсов",
    description:
      "На данный момент слишком много активных тренировок, попробуйте позже",
  },

  [WorkoutDisconnectStatus.Error]: {
    title: "Проблемы с интернет соединением",
    description: "Попробуйте перезагрузить страницу...",
  }
};

export class WorkoutRoom implements WorkoutWorkerDelegate {
  private worker?: WorkoutWorker;
  private api = new WorkoutApi();
  private _totalTimer?: number;

  public inviteCode: string = ""

  public workout?: WorkoutModel;
  public queue?: QueueExercises;
  public hinted = new Set<string>();
  public progress = 0;

  public exercises: Record<string, Exercise> = {};
  public exercise: ExerciseState | null = null;
  public state: WorkoutState = WorkoutState.Loading;
  public error = { title: "", description: "" };
  public highlightSkelet = false;
  public totalTime = 0;

  constructor() {
    makeObservable(this, {
      highlightSkelet: observable,
      totalTime: observable,
      exercise: observable,
      progress: observable,
      state: observable,
      error: observable,
      inviteCode: observable,

      generateInvite: action,
      processFrame: action,
      onDidNextExercise: action,
      onDidDisconnect: action,
      onDidStart: action,
    });
  }

  async generateInvite() {
    try {
      this.state = WorkoutState.Invite;
      this.inviteCode = "FORA" + Math.random().toString(36).substr(2, 9);
      const session = await watchConfirmRequest(this.inviteCode)
      const newURL = new URL(window.location.href);
      newURL.search = '?w=' + session;
      window.history.pushState({ path: newURL.href }, 'FORA.VISION', newURL.href);
      await this.initialize(session);
    } catch {
      setTimeout(() => this.generateInvite(), 5000)
    }
  }

  async initialize(jwt: string) {
    try {
      const { workout, session } = await this.api.loadRoom(jwt);
      this.api.setAuthToken(session);
      this.workout = workout;

      this.exercises = await this.api.getExercises(workout.id);
      this.queue = new QueueExercises(workout.program.sets);
      this.worker = new WorkoutWorker(workout.id);
      this.worker!.delegate = this;

      this._totalTimer = setInterval(() => {
        runInAction(() => (this.totalTime += 1));
      }, 1000) as any;
    } catch {
      runInAction(() => {
        this.state = WorkoutState.Error
        this.error = initializeError
      })
    }
  }

  getExercise(): Exercise | null {
    const id = this.exercise?.label;
    if (id) return this.exercises[id] ?? null;
    return null;
  }

  processFrame = (skelet: SkeletData) => {
    this.worker?.sendFrame(skelet);
  };

  async onDidCompleteExercise() {
    if (!this.queue) return;
    const exercise = this.queue.completeOne();

    this.exercise = exercise;
    this.highlightSkelet = true;
    this.progress = this.queue?.progress || 0;
    this.state = WorkoutState.Running;
    setTimeout(() => {
      runInAction(() => (this.highlightSkelet = false));
    }, 1000);

    if (exercise && !this.hinted.has(exercise.label)) {
      this.state = WorkoutState.Hint;
      this.hinted.add(exercise.label);
    }
  }

  onDidNextExercise(wrk: WorkoutWorker, exercise: string, num: number): void {
    this.queue?.setPointer(num);
    this.exercise = this.queue?.currentExercise || null;
    this.progress = this.queue?.progress || 0;
  }

  onDidDisconnect(worker: WorkoutWorker, status: WorkoutDisconnectStatus) {
    clearInterval(this._totalTimer);

    if (status === WorkoutDisconnectStatus.Success) {
      this.state = WorkoutState.Complete;
    } else {
      this.state = WorkoutState.Error;
      this.error = errorMessages[status] || {
        title: `Произошла неизвестная ошибка: ${status}`,
        description: "Попробуйте позже, мы скоро все исправим!",
      };
    }
  }

  onDidStart(): void {
    this.exercise = this.queue!.currentExercise;
    this.state = WorkoutState.Hint;
    this.hinted.add(this.exercise!.label);
  }
}
