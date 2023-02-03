import { action, computed, makeObservable, observable, runInAction } from "mobx";
import mixpanel from 'mixpanel-browser';
mixpanel.init("063e9838740260bebb040a86ddca9f83")

import { WorkoutWorker, WorkoutApi, WorkoutWorkerDelegate, WorkoutDisconnectStatus, watchConfirmRequest } from "./api";
import { Exercise, SkeletData, WorkoutModel } from "./models";

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
  description: "Такой тренировки не существует или отсутствует соединение с сервером",
};

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
    description: "На данный момент слишком много активных тренировок, попробуйте позже",
  },

  [WorkoutDisconnectStatus.Error]: {
    title: "Проблемы с интернет соединением",
    description: "Попробуйте перезагрузить страницу...",
  },
};

export class WorkoutRoom implements WorkoutWorkerDelegate {
  private worker?: WorkoutWorker;
  private api = new WorkoutApi();
  private _totalTimer?: number;

  private audio = new Audio();

  public workout: WorkoutModel | null = null;
  public showReplaceButton = false;
  public inviteCode = "";

  public exercise = "";
  public progressCount = 0;
  public exerciseCount = 0;
  public pipeline: number[] = [];

  public exercises: Record<string, Exercise> = {};
  public state: WorkoutState = WorkoutState.Loading;
  public error = { title: "", description: "" };
  public highlightSkelet = false;
  public totalTime = 0;

  constructor() {
    makeObservable(this, {
      highlightSkelet: observable,
      totalTime: observable,
      exercise: observable,
      state: observable,
      error: observable,

      inviteCode: observable,
      showReplaceButton: observable,
      exerciseCount: observable,
      progressCount: observable,
      pipeline: observable,
      workout: observable,

      progress: computed,
      isSavePhotos: computed,

      processFrame: action,
      generateInvite: action,
      onDidReplaceExercise: action,
      onDidNextExercise: action,
      onDidDisconnect: action,
      onDidStart: action,
    });

    const soundUrl = new URL("./assets/complete.wav", import.meta.url);
    this.audio.src = soundUrl.toString();
  }

  async generateInvite() {
    this.state = WorkoutState.Invite;

    // We dont support mobile now :(
    // try {
    //   this.state = WorkoutState.Invite;
    //   this.inviteCode = "FORA" + Math.random().toString(36).substr(2, 9);
    //   const session = await watchConfirmRequest(this.inviteCode);
    //   const newURL = new URL(window.location.href);
    //   newURL.search = "?w=" + session;
    //   window.history.pushState({ path: newURL.href }, "FORA.VISION", newURL.href);
    //   await this.initialize(session, true);
    // } catch {
    //   setTimeout(() => this.generateInvite(), 5000);
    // }
  }

  async initialize(jwt: string, fromQR = false) {
    try {
      const { workout, session, user_id } = await this.api.loadRoom(jwt);
      this.api.setAuthToken(session);
      runInAction(() => (this.workout = workout));

      mixpanel.identify(user_id.toString());
      mixpanel.track("WEB_RUN_ROOM", { workout: workout.id, fromQR });

      this.exercises = await this.api.getExercises(workout.id);
      this.worker = new WorkoutWorker(workout.id);
      this.worker!.delegate = this;

      for (let set of workout.program.sets) {
        for (let repeat = 0; repeat < set.repeats; repeat++) {
          this.pipeline.push(...set.exercises.map((ex) => ex.count));
        }
      }

      this._totalTimer = setInterval(() => {
        runInAction(() => (this.totalTime += 1));
      }, 1000) as any;
    } catch {
      mixpanel.track("WEB_ERROR");
      runInAction(() => {
        this.state = WorkoutState.Error;
        this.error = initializeError;
      });
    }
  }

  get progress() {
    const total = this.pipeline.reduce((a, b) => a + b, 0);
    return this.progressCount / total;
  }

  get isSavePhotos(): boolean {
    return this.workout?.save_photos ?? false;
  }

  getExercise(): Exercise | null {
    if (this.exercise) return this.exercises[this.exercise] ?? null;
    return null;
  }

  processFrame = (skelet: SkeletData, width: number, height: number) => {
    this.worker?.sendFrame(skelet, width, height);
  };

  onPhoto = (frame: number, photo: Blob) => {
    if (this.workout == null) return;
    if (this.isSavePhotos == false) return;
    this.api.uploadPhoto(this.workout.id, frame, photo);
  };

  async onDidCompleteExercise() {
    if (this.workout == null) return;

    this.highlightSkelet = true;
    this.exerciseCount -= 1;
    this.progressCount += 1;

    if (this.progressCount % 5 === 0) {
      this.audio.volume = 0.6;
      this.audio.play();
    }

    mixpanel.track("WEB_СOMPLETE_EXERCISE", {
      workout: this.workout.id,
      progress: this.progress,
    });

    setTimeout(() => {
      runInAction(() => (this.highlightSkelet = false));
    }, 1000);
  }

  showReplaceButtonWithDelay() {
    setTimeout(() => {
      runInAction(() => {
        this.showReplaceButton = true;
      });
    }, 20000);
  }

  replaceExercise() {
    if (!this.showReplaceButton) return;
    this.worker?.replaceExercise();
    this.showReplaceButton = false;
    this.showReplaceButtonWithDelay();
  }

  onDidReplaceExercise(wrk: WorkoutWorker, exercise: string, count: number, position: number): void {
    mixpanel.track("WEB_REPLACE_EXERCISE", { workout: wrk.workoutId, exercise, count, position });
    this.onDidNextExercise(wrk, exercise, count, position);
  }

  onDidNextExercise(wrk: WorkoutWorker, exercise: string, count: number, position: number): void {
    mixpanel.track("WEB_NEXT_EXERCISE", { workout: wrk.workoutId, exercise, count, position });

    this.pipeline[position] = count;
    this.progressCount = this.pipeline.slice(0, position).reduce((a, b) => a + b, 0);
    this.state = WorkoutState.Hint;
    this.exerciseCount = count;
    this.exercise = exercise;
  }

  onDidDisconnect(wrk: WorkoutWorker, status: WorkoutDisconnectStatus) {
    mixpanel.track("WEB_DISCONNECT", { workout: wrk.workoutId, status });
    clearInterval(this._totalTimer);

    if (status === WorkoutDisconnectStatus.SuccessWorkout) {
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
    this.showReplaceButtonWithDelay();
  }
}
