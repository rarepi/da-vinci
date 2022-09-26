import { setTimeout } from "timers";

const MAX_TIMER_MS = 2147483647;

export class LongTimer {
    private callback: () => void;
    private ms: number;
    private timeout: NodeJS.Timer | NodeJS.Timeout | undefined;
    private interval: boolean;

    constructor(callback: () => void, ms?: number, repeat?: boolean) {
        this.callback = callback;
        this.ms = ms ?? 0;
        this.interval = repeat ?? false;
    }

    public isInterval() {
        return this.interval;
    }

    public start() {
        // use default timer functions if time is in range
        if(this.ms <= MAX_TIMER_MS) {
            if(this.interval) {
                this.timeout = global.setInterval(this.callback, this.ms);
            } else {
                this.timeout = global.setTimeout(this.callback, this.ms);
            }
            return;
        }

        // if time exceeds timer limits, use a chain of timeouts
        if(this.interval) {
            this.startInterval(this.ms);
        } else {
            this.startTimeout(this.ms);
        }
    }

    public restart() {
        this.cancel();
        this.start();
    }

    public cancel() {
        if(this.interval && this.ms <= MAX_TIMER_MS)
            clearInterval(this.timeout);
        else
            clearTimeout(this.timeout);
    }

    private startInterval(ms: number) {
        if(ms <= MAX_TIMER_MS) {
            this.timeout = global.setTimeout(() => {
                this.callback();
                this.restart();
            }, ms);
        } else {
            this.timeout = global.setTimeout(() => {
                this.startTimeout(ms - MAX_TIMER_MS)
            }, MAX_TIMER_MS);
        }
    }

    private startTimeout(ms: number) {
        if(ms <= MAX_TIMER_MS) {
            this.timeout = setTimeout(this.callback, ms);
        } else {
            this.timeout = setTimeout(() => {
                this.startTimeout(ms - MAX_TIMER_MS)
            }, MAX_TIMER_MS);
        }
    }
}