const {
    executeTask
} = require("./executor");

const task = {
    taskId: "TASK-001",
    type: "PRIME",
    start: 1,
    end: 100
};

(async () => {
    try {
        const result = await executeTask(task);

        console.log("FINAL RESULT:");
        console.log(result);

    } catch (error) {
        console.error(
            `Task failed: ${error.message}`
        );
    }
})();
