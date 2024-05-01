import { action, computed, makeObservable, observable, runInAction } from "mobx";
import levenshtein from "fast-levenshtein";
import mapValues from "lodash/mapValues";
import mixpanel from "mixpanel-browser";

import { WorkoutApi } from "../api";
import { Exercise, SkeletData, WorkoutModel } from "../types";
import { WorkoutDisconnectStatus, WorkoutWorker, WorkoutWorkerDelegate } from "./Worker";
import { framesStats } from "../stats";

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

const audio = {
  "cant-replace": new URL("../assets/voice/cant-replace.mp3", import.meta.url),
  "hide-ex": new URL("../assets/voice/hide-ex.mp3", import.meta.url),
  okay: new URL("../assets/voice/okay.mp3", import.meta.url),
  replaced: new URL("../assets/voice/replaced.mp3", import.meta.url),
  "show-ex": new URL("../assets/voice/show-ex.mp3", import.meta.url),
};

const speech = mapValues(audio, (url) => {
  const audio = new Audio();
  audio.src = url;
  return audio;
});

console.log({ speech });

export class WorkoutRoom implements WorkoutWorkerDelegate {
  private worker?: WorkoutWorker;
  private api = new WorkoutApi();
  private _totalTimer?: number;

  private audio = new Audio();

  public workout: WorkoutModel | null = null;
  public showReplaceButton = false;

  public exercise = "";
  public progressCount = 0;
  public exerciseCount = 0;
  public pipeline: number[] = [];

  public exercises: Record<string, Exercise> = {};
  public state: WorkoutState = WorkoutState.Loading;
  public error = { title: "", description: "" };
  public highlightSkelet = false;
  public totalTime = 0;

  public showExerciseExample = false;
  public recognition: any = null;

  constructor() {
    makeObservable(this, {
      highlightSkelet: observable,
      totalTime: observable,
      exercise: observable,
      state: observable,
      error: observable,

      recognition: observable,
      toggleAssistant: action,
      showExerciseExample: observable,
      setShowExerciseExample: action,
      replaceExercise: action,

      showReplaceButton: observable,
      exerciseCount: observable,
      progressCount: observable,
      pipeline: observable,
      workout: observable,

      progress: computed,
      isSavePhotos: computed,

      processFrame: action,
      onDidReplaceExercise: action,
      onDidNextExercise: action,
      onDidDisconnect: action,
      onDidStart: action,
    });

    const soundUrl = new URL("../assets/complete.wav", import.meta.url);
    this.audio.src = soundUrl.toString();
  }

  setShowExerciseExample(is: boolean) {
    this.showExerciseExample = is;
  }

  toggleAssistant = () => {
    if (this.recognition) {
      this.recognition.stop();
      this.recognition = null;
      return;
    }

    // @ts-ignore
    this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;
    this.recognition.continuous = true;
    this.recognition.lang = "ru";

    this.recognition.onsoundend = (e) => console.log("onsoundend", e);
    this.recognition.onsoundstart = (e) => console.log("onsoundstart", e);
    this.recognition.onerror = (e) => {
      setTimeout(() => this.recognition.start(), 100);
      this.recognition.stop();
      console.log(e);
    };

    this.recognition.onresult = (event) => {
      const result = event.results[event.resultIndex];
      const words = result[0].transcript.split(/\s+/);

      const commands = {
        fora: { word: ["фора", "fora", "папа"], distance: Infinity },
        replace: { word: ["замени", "меню"], distance: Infinity },
        show: { word: ["покажи", "открой", "делать"], distance: Infinity },
        hide: { word: ["закрой", "скрой", "убери"], distance: Infinity },
      };

      words.forEach((recognized) => {
        Object.values(commands).forEach((cmd) => {
          const dst = Math.min(...cmd.word.map((w) => levenshtein.get(recognized, w)));
          if (dst < cmd.distance) cmd.distance = dst;
        });
      });

      console.log(words.join(" "), commands);

      if (commands.fora.distance > 1) return;
      if (commands.hide.distance < 2) {
        this.setShowExerciseExample(false);
        speech["hide-ex"].play();
      } else if (commands.show.distance < 2) {
        this.setShowExerciseExample(true);
        speech["show-ex"].play();
      }

      if (commands.replace.distance < 2) {
        if (!this.showReplaceButton) {
          speech["cant-replace"].play();
          return;
        }

        this.replaceExercise();
        speech["replaced"].play();
      }
    };

    this.recognition.start();
  };

  frameId = 0;
  async initialize(jwt: string, fromQR = false) {
    try {
      this.api = new WorkoutApi(jwt);
      const room = await this.api.loadRoom(jwt);
      if (!("workout" in room)) throw Error();

      const { workout, user_id } = room;
      this.frameId = workout.frame_id;

      runInAction(() => (this.workout = workout));
      mixpanel.identify(user_id.toString());
      mixpanel.track("WEB_RUN_ROOM", { workout: workout.id, fromQR });

      this.exercises = await this.api.getExercises();
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

  frameCount = 0;
  processFrame = (skelet: SkeletData, width: number, height: number) => {
    this.frameId += 1;
    this.frameCount += 1;
    framesStats.update(this.frameCount, this.frameCount * 2);
    this.worker?.sendFrame(skelet, width, height, this.frameId);
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
