import { setTimeout } from "timers";

/** The maximum amount of milliseconds supported by default JavaScript timers due to a 32 bit limitation */
const MAX_TIMER_MS = 2147483647;

/**
 * Low precision timer using chains of timeouts to circumvent the time limitations on stock JavaScript timers
 * 
 * Warning: The chaining of timeouts might create some overhead time, so consider this a low precision timer.
 */
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

    /**
     * Creates a new interval timer
     * @param {Function} callback Function to be called on each timeout
     * @param {number} ms Time for each interval
     * @returns {LongTimer} The new interval timer
     */
    public static setInterval(callback: () => void, ms?: number) : LongTimer {
        const timer = new LongTimer(callback, ms, true);
        timer.start();
        return timer;
    }

    /**
     * Creates a new single-timeout timer
     * @param {Function} callback Function to be called on timeout
     * @param {number} ms Time till timeout
     * @returns {LongTimer} The new single-timeout timer
     */
    public static setTimeout(callback: () => void, ms?: number) : LongTimer {
        const timer = new LongTimer(callback, ms, false);
        timer.start();
        return timer;
    }

    /**
     * Returns whether or not this timer is an repeating interval
     * @returns {boolean} Whether or not this timer is an repeating interval
     */
    public isInterval() : boolean {
        return this.interval;
    }

    /**
     * Starts the timer
     */
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

    /**
     * Cancels the timer, then restarts it with the initial parameters
     */
    public restart() {
        this.cancel();
        this.start();
    }

    /**
     * Cancels the timer
     */
    public cancel() {
        if(this.interval && this.ms <= MAX_TIMER_MS)
            clearInterval(this.timeout);
        else
            clearTimeout(this.timeout);
    }

    /**
     * Starts a repeating interval using a recursive chain of timeouts
     * @param {number} ms Time till timeout
     */
    private startInterval(ms: number) {
        // if time is within limitations, execute the callback on timeout and restart the timer
        if(ms <= MAX_TIMER_MS) {
            this.timeout = global.setTimeout(() => {
                this.restart();
                this.callback();
            }, ms);
        // if time exceeds limitations, chain max length timeouts until it does not
        } else {
            this.timeout = global.setTimeout(() => {
                this.startTimeout(ms - MAX_TIMER_MS)
            }, MAX_TIMER_MS);
        }
    }

    /**
     * Starts a single timeout using a recursive chain of timeouts if necessary
     * @param {number} ms Time till timeout
     */
    private startTimeout(ms: number) {
        // if time is within limitations, execute the callback on timeout
        if(ms <= MAX_TIMER_MS) {
            this.timeout = global.setTimeout(this.callback, ms);
        // if time exceeds limitations, chain max length timeouts until it does not
        } else {
            this.timeout = global.setTimeout(() => {
                this.startTimeout(ms - MAX_TIMER_MS)
            }, MAX_TIMER_MS);
        }
    }
}