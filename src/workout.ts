import { action, makeObservable, observable, runInAction } from "mobx";
import { WorkoutWorker, WorkoutApi, WorkoutWorkerDelegate } from "./api";
import { SkeletData, WorkoutProgram } from "./models";

export class WorkoutRoom implements WorkoutWorkerDelegate {
    private worker: WorkoutWorker
    private api: WorkoutApi

    public isLoading = true
    public inFrame = false
    public program: WorkoutProgram

    constructor() {
        makeObservable(this, {
            isLoading: observable,
            inFrame: observable,
            processFrame: action
        })
    }

    async connect(jwt: string) {
        this.isLoading = true

        const { workoutId, session } = await this.api.loadRoom(jwt)
        this.api.setAuthToken(session)

        this.program = await this.api.getProgram(workoutId)
        const start = await this.api.startWorker(workoutId)
        
        this.worker = new WorkoutWorker(start.taskId)
        this.worker.delegate = this

        runInAction(() => this.isLoading = true)
    }

    processFrame(skelet: SkeletData) {
        if (!this.worker) return;
        this.inFrame = skelet.every(p => p.p > 0.5)
        this.worker.sendFrame(skelet);
    }
    
    onDidCompleteExercise(): void {
        console.log("onDidCompleteExercise")
    }

    onDidDisconnect(): void {
        console.log("onDidDisconnect")
    }

    onDidStart(): void {
        console.log("onDidStart")
    }
}