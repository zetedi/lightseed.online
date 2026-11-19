// A promise that gives up: rejects with `message` if the work has not settled in time.
export const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> =>
    new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
        promise
            .then((value) => {
                window.clearTimeout(timer);
                resolve(value);
            })
            .catch((error) => {
                window.clearTimeout(timer);
                reject(error);
            });
    });
