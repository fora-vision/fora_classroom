export const countFPS = (() => {
    let lastLoop = (new Date()).getMilliseconds();
    let count = 1;
    let fps = 0;

    return () => {
        let currentLoop = (new Date()).getMilliseconds();
        if (lastLoop > currentLoop) {
            fps = count;
            count = 1;
        } else {
            count += 1;
        }
        lastLoop = currentLoop;
        return fps;
    };
})();
