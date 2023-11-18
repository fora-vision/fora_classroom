import { action, computed, makeObservable, observable, runInAction } from "mobx";
import mixpanel from "mixpanel-browser";

import { WorkoutWorker, WorkoutApi, WorkoutDisconnectStatus } from "./api";
import { Exercise, SkeletData, WorkoutModel, WorkoutState } from "./types";
import { errorMessages, initializeError } from "./locales";
import { WorkoutOndevice } from "./recognizer/recognizer";

export class WorkoutRoom {
  private audio = new Audio();
  private worker?: WorkoutOndevice;
  private api = new WorkoutApi();
  private _totalTimer?: number;

  public workout: WorkoutModel | null = null;
  public showReplaceButton = false;
  public inviteCode = "";

  public completedActionsCount = 0;
  public pipeline: { label: string; count: number }[] = [];

  public exercises: Record<string, Exercise> = {};
  public state: WorkoutState = WorkoutState.Loading;
  public error = { title: "", description: "" };
  public highlightSkelet = false;
  public totalTime = 0;

  public isBlocked = false;

  constructor() {
    makeObservable(this, {
      highlightSkelet: observable,
      totalTime: observable,
      state: observable,
      error: observable,

      inviteCode: observable,
      showReplaceButton: observable,
      completedActionsCount: observable,
      pipeline: observable,
      workout: observable,

      position: computed,
      current: computed,
      progress: computed,
      actionsInCompletedExercises: computed,
      actionsLeftForCurrentExercise: computed,
      currentExerciseDetails: computed,
      isSavePhotos: computed,

      processFrame: action,
      onDidReplaceExercise: action,
      onDidDisconnect: action,
      onDidStart: action,
    });

    const soundUrl = new URL("./assets/complete.wav", import.meta.url);
    this.audio.src = soundUrl.toString();
  }

  async initialize(jwt: string, fromQR = false) {
    try {
      const { workout, session, user_id } = await this.api.loadRoom(jwt);
      this.exercises = await this.api.getExercises(workout.id);
      this.api.setAuthToken(session);

      mixpanel.identify(user_id.toString());
      mixpanel.track("WEB_RUN_ROOM", { workout: workout.id, fromQR });

      runInAction(() => {
        this.pipeline = [];
        for (let set of workout.program.sets) {
          for (let repeat = 0; repeat < set.repeats; repeat++) {
            this.pipeline.push(...set.exercises.map((ex) => ({ ...ex })));
          }
        }

        this.workout = workout;
        this.state = WorkoutState.Running;
        this.worker = new WorkoutOndevice(this);

        this._totalTimer = setInterval(() => {
          runInAction(() => (this.totalTime += 1));
        }, 1000) as any;
      });
    } catch (e) {
      console.log(e);
      mixpanel.track("WEB_ERROR");
      runInAction(() => {
        this.state = WorkoutState.Error;
        this.error = initializeError;
      });
    }
  }

  get current(): { label: string; count: number } | null {
    return this.pipeline[this.position] || null;
  }

  get position() {
    let before = 0;
    let after = 0;
    return this.pipeline.findIndex((t) => {
      after += t.count;
      const isAdjust = this.completedActionsCount >= before && this.completedActionsCount < after;
      before = after;
      return isAdjust;
    });
  }

  get progress() {
    const total = this.pipeline.reduce((a, b) => a + b.count, 0);
    return this.completedActionsCount / total;
  }

  get actionsInCompletedExercises() {
    return this.pipeline.slice(0, this.position).reduce((a, b) => a + b.count, 0);
  }

  get actionsLeftForCurrentExercise() {
    if (this.current == null) return 0;
    return this.actionsInCompletedExercises + this.current.count - this.completedActionsCount;
  }

  get isSavePhotos(): boolean {
    return this.workout?.save_photos ?? false;
  }

  get currentExerciseDetails(): Exercise | null {
    if (this.current == null) return null;
    return this.exercises[this.current.label] ?? null;
  }

  processFrame = (skelet: SkeletData, width: number, height: number) => {
    if (this.isBlocked) return;
    this.worker?.sendFrame(skelet, width, height);
  };

  onPhoto = (frame: number, photo: Blob) => {
    if (this.workout == null) return;
    if (this.isSavePhotos == false) return;
    this.api.uploadPhoto(this.workout.id, frame, photo);
  };

  private _highlightSkeletTimer?: NodeJS.Timeout;
  async onDidCompleteExercise() {
    if (this.workout == null || this.current == null) return;

    this.highlightSkelet = true;
    this.completedActionsCount += 1;
    if (this.completedActionsCount % 5 === 0) {
      this.audio.volume = 0.6;
      this.audio.play();
    }

    mixpanel.track("WEB_СOMPLETE_EXERCISE", { workout: this.workout.id, progress: this.progress });
    if (this.current && this.actionsLeftForCurrentExercise === this.current.count) {
      this.isBlocked = true;
      this.state = WorkoutState.Hint;
      mixpanel.track("WEB_NEXT_EXERCISE", {
        workout: this.workout.id,
        exercise: this.current.label,
        count: this.current.count,
        position: this.position,
      });

      setTimeout(() => {
        this.isBlocked = false;
      }, 1000);
    }

    if (this.progress === 1) {
      this.state = WorkoutState.Complete;
      mixpanel.track("WEB_WORKOUT_COMPLETE");
    }

    clearTimeout(this._highlightSkeletTimer);
    this._highlightSkeletTimer = setTimeout(() => {
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

    this.pipeline[position] = { label: exercise, count };
    this.completedActionsCount = this.pipeline.slice(0, this.position).reduce((a, b) => a + b.count, 0);
    this.state = WorkoutState.Hint;
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
