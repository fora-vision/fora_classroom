import { Exercise, WorkoutSet } from "./models"

export interface QueuePointer {
    isFinished: boolean;
    nextExercise?: string;
    nextSet?: number;
}

export interface ExerciseState {
    set: number
    label: string
    count: number
}

export class QueueExercises {
    private sets: number[] = []
    private exercises: ExerciseState[] = []
    public total = 0
    public pointer = 0

    constructor(readonly program: WorkoutSet[]) {
        // for simplicity, we generate a flat queue
        for (let set = 0; set < program.length; set++) {
            for (let repeat = 0; repeat < program[set].repeats; repeat++) {
                for (let ex of program[set].exercises) {
                    this.total += ex.count
                    this.exercises.push({ ...ex, set: set })
                }
            }
        }
    }

    setPointer(pointer: number) {
        this.pointer = pointer
        this.exercises.forEach((ex, i) => {
            if (i >= pointer) return;
            ex.count = 0
        })
    }

    completeOne(): ExerciseState | null {
        if (this.isFinished) return null
        
        this.exercises[this.pointer].count -= 1
        if (this.exercises[this.pointer].count == 0) this.pointer += 1
        if (this.isFinished) return null

        return this.currentExercise
    }

    get progress() {
        const left = this.exercises.reduce((sum, ex) => sum + ex.count, 0)
        return  (this.total - left) / this.total
    }

    get currentExercise() {
        return this.exercises[this.pointer] ?? null
    }

    get isFinished() {
        return this.pointer >= this.exercises.length
    }
}