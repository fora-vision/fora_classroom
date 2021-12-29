import { action, makeObservable, observable, runInAction } from "mobx";
import { WorkoutWorker, WorkoutApi, WorkoutWorkerDelegate } from "./api";
import { Exercise, SkeletData, WorkoutModel } from "./models";
import { ExerciseState, QueueExercises } from './queue';

export enum WorkoutState {
    Loading,
    Running,
    Hint,
    Relax,
    Error,
    Warning,
    Complete,
    Failed
}

export class WorkoutRoom implements WorkoutWorkerDelegate {
    private worker?: WorkoutWorker
    private api = new WorkoutApi()
    private _totalTimer?: number

    public workout?: WorkoutModel
    public queue?: QueueExercises
    public hinted = new Set<string>()

    public exercises: Record<string, Exercise> = {}
    public exercise: ExerciseState | null = null
    public state: WorkoutState = WorkoutState.Loading
    public isLoading = true
    public inFrame = false
    public totalTime = 0
    public highlightSkelet = false
    public taskId = 0

    constructor() {
        makeObservable(this, {
            totalTime: observable,
            isLoading: observable,
            inFrame: observable,
            state: observable,
            exercise: observable,
            highlightSkelet: observable,
            processFrame: action,
            onDidDisconnect: action,
            onDidStart: action
        })
    }

    async initialize(jwt: string) {   
        this.isLoading = true

        const { workout, session } = await this.api.loadRoom(jwt)
        this.api.setAuthToken(session)
        this.workout = workout

        const start = await this.api.startWorker(workout.id)
        this.exercises = await this.api.getExercises(workout.id)
        this.queue = new QueueExercises(workout.program.sets)
        this.queue.setPointer(start.exercises)
        
        this.taskId = start.taskId
        this.worker = new WorkoutWorker(start.taskId)
        this.worker!.delegate = this

        this._totalTimer = setInterval(() => {
            runInAction(() => this.totalTime += 1)
        }, 1000) as any;

        runInAction(() => this.isLoading = false)
    }

    getExercise(): Exercise | null {
        const id = this.exercise?.label;
        if (id) return this.exercises[id] ?? null
        return null
    }

    get progress() {
        return this.queue?.progress ?? 0
    }

    async completeGame() {
        if (!this.workout) return;
        clearInterval(this._totalTimer)
        await this.api.stopWorker(this.taskId)
        runInAction(() => this.state = WorkoutState.Complete)
    }

    processFrame = (skelet: SkeletData) => {
        this.worker?.sendFrame(skelet);
    }
    
    async onDidCompleteExercise() {
        if (!this.queue) return;
        const prevPointer = this.queue.pointer
        const exercise = this.queue.completeOne()

        runInAction(() => {
            this.exercise = exercise
            this.highlightSkelet = true
            this.state = WorkoutState.Running
            setTimeout(() => {
                runInAction(() => this.highlightSkelet = false)
            }, 1000);

            if (exercise && !this.hinted.has(exercise.label)) {
                this.state = WorkoutState.Hint
                this.hinted.add(exercise.label)
            }
        })

        if (this.queue.isFinished) return await this.completeGame()
        if (prevPointer !== this.queue.pointer) {
            this.worker?.nextExercise(exercise!.label)
        }
    }

    onDidDisconnect(worker: WorkoutWorker) {
        this.state = WorkoutState.Failed
    }

    onDidStart(): void {
        this.exercise = this.queue!.currentExercise
        this.state = WorkoutState.Hint
        this.hinted.add(this.exercise!.label)

        if (this.exercise) {
            this.worker!.nextExercise(this.exercise.label);
        }
    }
}