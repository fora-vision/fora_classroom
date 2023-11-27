import type { PyodideInterface, loadPyodide } from "pyodide";
import { loadGraphModel } from "@tensorflow/tfjs-converter";
import * as tf from "@tensorflow/tfjs";

import { WorkoutRoom } from "../WorkoutStore";
import { SkeletData } from "../types";
import Counter from "./Counter";
import stats, { predictStats } from "../stats";

type Model = tf.GraphModel<string | tf.io.IOHandler>;

export class RecognizerOndevice {
  private isStarted = false;
  private isInitialized = false;
  private models: Record<string, Promise<{ hand: Model; leg: Model }>> = {};
  private counter = new Counter(10, this);
  private py?: PyodideInterface;

  public config: Record<string, any> | null = null;
  constructor(readonly workout: WorkoutRoom) {}

  loadModel = async (exercise: string) => {
    return {
      hand: await loadGraphModel(`${this.media}/models/${exercise}_hand/model.json`),
      leg: await loadGraphModel(`${this.media}/models/${exercise}_leg/model.json`),
    };
  };

  get width() {
    return this.config?.image_width ?? 0;
  }

  get height() {
    return this.config?.image_height ?? 0;
  }

  get media() {
    return `https://storage.fora.vision/models/${this.workout.workout?.model_version}`;
  }

  async initialize() {
    this.config = await (await fetch(`${this.media}/config.json`)).json();
    const pythonPredictor = await (await fetch(`${this.media}/predictor.py`)).text();

    // @ts-ignore
    this.py = await loadPyodide();
    await this.py.loadPackage("numpy");

    const loadFile = async (url: string) => Uint8Array.from((await (await fetch(url)).arrayBuffer()) as any);
    this.py.FS.writeFile("/poses_graph.pickle", await loadFile(`${this.media}/poses_graph.pickle`));
    this.py.FS.writeFile("/classes.pickle", await loadFile(`${this.media}/classes.pickle`));

    this.py.runPython(`Config = ${JSON.stringify(this.config)}`);
    this.py.globals.set("js_predict", async (exercise, part, batch) => {
      if (this.models[exercise] == null) {
        this.models[exercise] = this.loadModel(exercise);
      }

      const model = await this.models[exercise];
      const data = model[part].execute(tf.tensor2d(batch.toJs(), [12, 90]));
      if (Array.isArray(data)) return data[0].array();
      return data.array();
    });

    if (this.workout.current) {
      const ex = this.workout.current.label;
      this.models[ex] = this.loadModel(ex);
      await this.models[ex];
    }

    this.py.runPython(pythonPredictor);
    this.isInitialized = true;
  }

  replaceExercise() {
    if (!this.isStarted) return;
  }

  async sendFrame(points: SkeletData, width: number, height: number) {
    if (!this.workout.current) return false;
    if (!this.isInitialized) return false;
    if (!this.config) return false;

    const perf = performance.now();
    if (this.config.image_width !== width || this.config.image_height !== height) {
      this.config.image_height = height;
      this.config.image_width = width;
      this.py?.runPython(`Config = ${JSON.stringify(this.config)}`);
    }

    const ex = this.workout.current.label;
    const perform = `await predict_frames('${ex}', ${JSON.stringify([points])})`;
    const result = await this.py?.runPythonAsync(perform);
    const id = result.toJs()[0][0];

    predictStats.update(performance.now() - perf, 200);

    return ex === this.counter.step(id);
  }
}
