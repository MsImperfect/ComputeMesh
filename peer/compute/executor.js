// ========================================
// Compute Task Executor
// ========================================

const {
    executePrimeTask
} = require("./primeTask");


// ========================================
// Execute Task
// ========================================

function executeTask(task) {
    if (!task) {
        throw new Error(
            "Cannot execute an empty task"
        );
    }

    if (!task.taskId) {
        throw new Error(
            "Task must have a taskId"
        );
    }

    if (!task.type) {
        throw new Error(
            "Task must have a type"
        );
    }

    console.log("");
    console.log(
        "========================================"
    );
    console.log(
        "             TASK EXECUTOR"
    );
    console.log(
        "========================================"
    );

    console.log(
        `Task ID:        ${task.taskId}`
    );

    console.log(
        `Task Type:      ${task.type}`
    );

    console.log(
        `Start:          ${task.start ?? "-"}`
    );

    console.log(
        `End:            ${task.end ?? "-"}`
    );

    console.log(
        "----------------------------------------"
    );

    const startTime = Date.now();

    let result;

    switch (task.type) {

        case "PRIME":
            result = executePrimeTask(task);
            break;

        default:
            throw new Error(
                `Unsupported task type: ${task.type}`
            );
    }

    const totalExecutionTime =
        Date.now() - startTime;

    result.totalExecutionTimeMs =
        totalExecutionTime;

    console.log(
        `Execution Time: ${totalExecutionTime} ms`
    );

    console.log(
        `Result Count:   ${result.count ?? "-"}`
    );

    console.log(
        "========================================"
    );

    console.log("");

    return result;
}


// ========================================
// Export
// ========================================

module.exports = {
    executeTask
};