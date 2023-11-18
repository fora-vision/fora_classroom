import type { PyodideInterface, loadPyodide } from "pyodide";
import { loadGraphModel } from "@tensorflow/tfjs-converter";
import * as tf from "@tensorflow/tfjs";

import { Exercise, SkeletData } from "../types";
import { WorkoutRoom } from "../WorkoutStore";

import Config from "./config.json"; // @ts-ignore
import pythonPredictor from "bundle-text:./predictor.py";
import Counter from "./counter";

type Model = tf.GraphModel<string | tf.io.IOHandler>;

export class WorkoutOndevice {
  private isStarted = false;
  private isInitialized = false;
  private models: Record<string, Promise<{ hand: Model; leg: Model }>> = {};
  private counter = new Counter(10);
  private py?: PyodideInterface;

  constructor(readonly workout: WorkoutRoom) {
    this.initialize();
  }

  loadModel = async (exercise: string) => {
    return {
      hand: await loadGraphModel(`/models/${exercise}_hand/model.json`),
      leg: await loadGraphModel(`/models/${exercise}_leg/model.json`),
    };
  };

  async initialize() {
    // @ts-ignore
    this.py = await loadPyodide();
    await this.py.loadPackage("numpy");

    const loadFile = async (url: string) => Uint8Array.from((await (await fetch(url)).arrayBuffer()) as any);
    this.py.FS.writeFile("/poses_graph.pickle", await loadFile("/poses_graph.pickle"));
    this.py.FS.writeFile("/classes.pickle", await loadFile("/classes.pickle"));

    this.py.runPython(`Config = ${JSON.stringify(Config)}`);
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
    if (!this.workout.current) return;
    if (!this.isInitialized) return;

    const ex = this.workout.current.label;
    const perform = `await predict_frames('${ex}', ${JSON.stringify([points])})`;
    const result = await this.py?.runPythonAsync(perform);
    const id = result.toJs()[0][0];

    const isRecognized = ex === this.counter.step(id);
    if (isRecognized) this.workout.onDidCompleteExercise();
  }
}
