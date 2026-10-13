const {
    executeTask
} = require("./executor");

const task = {
    taskId: "TASK-001",
    type: "PRIME",
    start: 1,
    end: 100
};

try {
    const result = executeTask(task);

    console.log("FINAL RESULT:");
    console.log(result);

} catch (error) {
    console.error(
        `Task failed: ${error.message}`
    );
}
