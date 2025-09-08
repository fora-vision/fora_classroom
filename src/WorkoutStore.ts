import { action, computed, flow, makeObservable, observable, runInAction } from "mobx";
import mixpanel from "mixpanel-browser";
import crypto from "crypto";

import { Exercise, SkeletData, WorkoutBatch, WorkoutModel, WorkoutState, WorkoutStatus, initializeError } from "./types";
import { RecognizerOndevice } from "./recognizer/recognizer";
import { framesStats, uploadStats } from "./stats";
import { AutoQueue, wait } from "./helpers";
import { WorkoutApi } from "./api";

export class WorkoutRoom {
  private audio = new Audio();
  private worker: RecognizerOndevice;
  private api = new WorkoutApi();
  private _totalTimer?: number;

  public workout: WorkoutModel | null = null;
  public showReplaceButton = false;
  public exerciseReplacing = false;

  public completedActionsCount = 0;
  public pipeline: { label: string; count: number }[] = [];

  public exercises: Record<string, Exercise> = {};
  public state: WorkoutState = WorkoutState.Loading;
  public error = { title: "", description: "" };
  public highlightSkelet = false;
  public isBlocked = false;
  public totalTime = 0;

  private frameId = 0;
  private batchesQueue = new AutoQueue();
  private completedExercises: WorkoutBatch["exercises"] = [];
  private completedFrames: SkeletData[] = [];
  private _highlightSkeletTimer?: number;

  constructor() {
    makeObservable(this, {
      highlightSkelet: observable,
      exerciseReplacing: observable,
      totalTime: observable,
      state: observable,
      error: observable,

      showReplaceButton: observable,
      completedActionsCount: observable,
      pipeline: observable,
      workout: observable,

      actionsInCompletedExercises: computed,
      actionsLeftForCurrentExercise: computed,
      currentExerciseDetails: computed,
      isSavePhotos: computed,
      position: computed,
      progress: computed,
      current: computed,

      onDidComplete: action,
      onDidError: action,
      processFrame: flow,
      initialize: flow,
    });

    this.audio.src = new URL("./assets/complete.wav", import.meta.url).toString();
    this.worker = new RecognizerOndevice(this);
  }

  *initialize(jwt: string, fromQR = false) {
    try {
      this.api = new WorkoutApi(jwt);
      const { workout, user_id, error } = yield this.api.loadRoom(jwt);

      if (error === "locked") {
        this.state = WorkoutState.Error;
        this.error = {
          title: "Закончились минуты",
          description: "Обратитесь к вашему тренеру, чтобы он исправил эту ошибку",
        };
        return;
      }

      if (workout.status === WorkoutStatus.DONE) {
        this.state = WorkoutState.Complete;
        return;
      }

      if (workout.status === WorkoutStatus.BANED) {
        this.state = WorkoutState.Error;
        this.error = {
          title: "Тренировка заблокирована",
          description: "Наша система заподозрила нечестное выполнение тренировки, если это ошибка, пожалуйста, напишите нам на aborisova@fora.vision",
        };
        return;
      }

      if (workout.status === WorkoutStatus.RECOGNIZING) {
        this.state = WorkoutState.Error;
        this.error = {
          title: "Проверяем тренировку",
          description: "Тренировка была завершена, мы проверяем, что все было выполнено правильно :)",
        };
        return;
      }

      this.exercises = yield this.api.getExercises();

      mixpanel.identify(user_id.toString());
      mixpanel.track("WEB_RUN_ROOM", { workout: workout.id, fromQR });
      this.pipeline = [];
      for (let set of workout.program.sets) {
        for (let repeat = 0; repeat < set.repeats; repeat++) {
          this.pipeline.push(...set.exercises.map((ex) => ({ ...ex })));
        }
      }

      const completed = this.pipeline.slice(0, workout.exercises_num);
      this.completedActionsCount = completed.reduce((acc, a) => acc + a.count, 0);
      this.frameId = workout.frame_id;
      this.workout = workout;

      yield this.worker.initialize();
      this.state = WorkoutState.Running;

      this._totalTimer = setInterval(() => {
        runInAction(() => (this.totalTime += 1));
      }, 1000) as any;
    } catch (e) {
      console.log(e);
      mixpanel.track("WEB_ERROR");
      this.state = WorkoutState.Error;
      this.error = initializeError;
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

  private prevTotalTimeForBatch = 0;
  private timeWithoutCompletedAction = 0;
  private frameCount = 0;

  *processFrame(skelet: SkeletData, width: number, height: number) {
    if (this.current == null || this.workout == null || this.worker == null) return;
    if (this.exerciseReplacing || this.isBlocked) return;
    if (this.state !== WorkoutState.Running) return;

    this.frameCount += 1;
    framesStats.update(this.frameCount, this.frameCount * 2);

    // Initialize time for first batch
    if (this.frameId === this.workout.frame_id) {
      this.prevTotalTimeForBatch = Date.now();
      this.timeWithoutCompletedAction = Date.now();
    }

    const label = this.current.label;
    const isRecognized = yield this.worker.sendFrame(skelet, width, height);
    this.completedFrames.push(skelet);
    this.frameId += 1;

    // Show exercise replace if user dont complete action 1 minute
    if (Date.now() - this.timeWithoutCompletedAction > 60_000 && !this.exerciseReplacing) {
      this.showReplaceButton = true;
    }

    // Every 80 frames we need send proof of workout
    if (this.completedFrames.length > 80) this.addBatch();
    if (!isRecognized) return;

    // Highlight skeleton for every action
    this.highlightSkelet = true;
    clearTimeout(this._highlightSkeletTimer);
    this._highlightSkeletTimer = +setTimeout(() => {
      runInAction(() => (this.highlightSkelet = false));
    }, 1000);

    this.completedActionsCount += 1;
    this.completedExercises.push({ frame_id: this.frameId, label });
    this.timeWithoutCompletedAction = Date.now();

    mixpanel.track("WEB_СOMPLETE_EXERCISE", { workout: this.workout.id, progress: this.progress });

    // Play complete sound every five actions
    if (this.completedActionsCount % 5 === 0) {
      this.audio.volume = 0.6;
      this.audio.play();
    }

    // Next exercise if actions equal maximum of current exercise
    if (this.current && this.actionsLeftForCurrentExercise === this.current.count) {
      mixpanel.track("WEB_NEXT_EXERCISE", {
        workout: this.workout.id,
        exercise: this.current.label,
        count: this.current.count,
        position: this.position,
      });

      // Block recognize for false positive recognizing
      setTimeout(() => (this.isBlocked = false), 1000);
      this.isBlocked = true;
    }

    // Progress 100% = complete workout!
    if (this.progress === 1) {
      this.onDidComplete();
    }
  }

  onPhoto = (frame: number, photo: Blob) => {
    if (this.workout == null) return;
    if (this.isSavePhotos == false) return;
    this.api.uploadPhoto(this.workout.id, frame, photo);
  };

  async replaceExercise() {
    if (!this.showReplaceButton || this.exerciseReplacing) return;
    this.showReplaceButton = false;
    this.exerciseReplacing = true;

    await this.batchesQueue.enqueue(async () => {
      const { exercise, count } = await this.api.replaceExercise();
      runInAction(() => {
        this.exerciseReplacing = false;
        this.timeWithoutCompletedAction = Date.now();
        this.pipeline[this.position] = { label: exercise, count };
        this.completedActionsCount = this.pipeline.slice(0, this.position).reduce((a, b) => a + b.count, 0);
        mixpanel.track("WEB_REPLACE_EXERCISE", { workout: this.workout?.id, exercise, count, position: this.position });
      });
    });
  }

  private totalKb = 0;
  async addBatch() {
    if (this.state !== WorkoutState.Running) return;
    const batch: WorkoutBatch = {
      total_time: Math.round((Date.now() - this.prevTotalTimeForBatch) / 1000), // diff time from prev batch
      frame: { width: this.worker.width, height: this.worker.height, horizontal: true },
      exercises: this.completedExercises,
      frames: this.completedFrames,
    };

    batch.proof = crypto
      .createHash("sha256")
      .update(JSON.stringify(batch) + this.api.jwt)
      .digest("base64");

    this.completedFrames = [];
    this.completedExercises = [];
    this.prevTotalTimeForBatch = Date.now();

    await this.batchesQueue.enqueue(async () => {
      if (this.state !== WorkoutState.Running) return;
      const sendBatch = async (attempts = 0) => {
        if (attempts >= 4) return this.onDidError();
        await this.api.batchWorkout(batch).catch(async () => {
          await wait(3000);
          await sendBatch(attempts + 1);
        });

        const size = new TextEncoder().encode(JSON.stringify(batch)).length;
        this.totalKb += size / 1024;
        uploadStats.update(this.totalKb, this.totalKb * 2);
      };

      await sendBatch();
    });
  }

  async onDidComplete() {
    await this.addBatch(); // send final batch
    await this.batchesQueue.enqueue(async () => {
      const tryStop = async (attempts = 0) => {
        if (attempts >= 4) return this.onDidError();
        await this.api.stopWorkout().catch(async () => {
          await wait(3000);
          await tryStop(attempts + 1);
        });
      };

      await tryStop();
    });

    this.state = WorkoutState.Complete;
    mixpanel.track("WEB_WORKOUT_COMPLETE");
  }

  onDidError() {
    clearInterval(this._totalTimer);
    mixpanel.track("WER_ERROR", { workout: this.workout?.id });
    this.error = { title: `Нет соединения c интернетом`, description: "Не удалось сохранить ваш прогресс, проверьте ваш интернет" };
    this.state = WorkoutState.Error;
    this.batchesQueue.clear();
  }
}
