// ========================================
// Result Aggregator
// ========================================

class ResultAggregator {
    constructor(jobManager, taskManager) {
        this.jobManager = jobManager;
        this.taskManager = taskManager;
    }

    // ====================================
    // Add Task Result
    // ====================================

    addTaskResult(taskId, result) {
        const task =
            this.taskManager.getTask(taskId);

        if (!task) {
            throw new Error(
                `Task ${taskId} not found`
            );
        }

        // Avoid duplicate result processing
        if (task.status === "COMPLETED") {
            console.log(
                `[AGGREGATOR] Task ${taskId} is already COMPLETED, ignoring duplicate result`
            );
            return this.checkJobCompletion(task.jobId);
        }

        this.taskManager.updateTask(
            taskId,
            {
                status: "COMPLETED",
                completedAt: Date.now(),
                result
            }
        );

        this.jobManager.addResult(
            task.jobId,
            result
        );

        console.log(
            `[AGGREGATOR] Result received for ${taskId}`
        );

        return this.checkJobCompletion(
            task.jobId
        );
    }

    // ====================================
    // Check Job Completion
    // ====================================

    checkJobCompletion(jobId) {
        const job =
            this.jobManager.getJob(jobId);

        if (!job) {
            return null;
        }

        const allTasksCompleted =
            job.taskIds.every(
                (taskId) => {
                    const task =
                        this.taskManager.getTask(
                            taskId
                        );

                    return (
                        task &&
                        task.status === "COMPLETED"
                    );
                }
            );

        if (!allTasksCompleted) {
            return null;
        }

        const finalResult =
            this.aggregateJobResults(job);

        // Attach result and execution metrics directly to the job object for dashboards & consumers
        job.result = finalResult;
        job.executionTimeMs = finalResult.totalExecutionTimeMs;

        this.jobManager.updateJobStatus(
            jobId,
            "COMPLETED"
        );

        console.log(
            `[AGGREGATOR] ${jobId} completed`
        );

        return finalResult;
    }

    // ====================================
    // Aggregate Results
    // ====================================

    aggregateJobResults(job) {
        if (job.type === "PRIME") {
            return this.aggregatePrimeResults(job);
        }
        if (job.type === "SCRIPT") {
            return this.aggregateScriptResults(job);
        }
        throw new Error(
            `Unsupported aggregation type: ${job.type}`
        );
    }

    // ====================================
    // Aggregate Prime Results
    // ====================================

    aggregatePrimeResults(job) {
        const allPrimes = [];

        for (const result of job.results) {
            if (
                result &&
                Array.isArray(result.primes)
            ) {
                allPrimes.push(
                    ...result.primes
                );
            }
        }

        // Remove duplicates and sort.
        const uniquePrimes =
            [...new Set(allPrimes)].sort(
                (a, b) => a - b
            );

        const totalExecutionTimeMs =
            job.results.reduce(
                (total, result) => {
                    return (
                        total +
                        Number(
                            result.executionTimeMs || 0
                        )
                    );
                },
                0
            );

        return {
            jobId: job.jobId,
            type: job.type,

            primeCount:
                uniquePrimes.length,

            primes:
                uniquePrimes,

            taskCount:
                job.taskIds.length,

            completedTaskCount:
                job.results.length,

            totalExecutionTimeMs,

            completedAt:
                Date.now()
        };
    }

    // ====================================
    // Aggregate Script Results
    // ====================================

    aggregateScriptResults(job) {
        const taskResults = job.results || [];
        const totalExecutionTimeMs = taskResults.reduce(
            (total, r) => total + Number(r.executionTimeMs || 0),
            0
        );

        const outputs = taskResults.map((r) => ({
            taskId: r.taskId,
            scriptName: r.scriptName,
            exitCode: r.exitCode,
            stdout: r.stdout,
            stderr: r.stderr,
            output: r.output,
            generatedFiles: r.generatedFiles || [],
            executionTimeMs: r.executionTimeMs
        }));

        let combinedData = null;
        const allOutputsAreArrays = outputs.length > 0 && outputs.every(o => Array.isArray(o.output));
        const allOutputsAreObjects = outputs.length > 0 && outputs.every(o => o.output && typeof o.output === "object" && !Array.isArray(o.output));

        if (allOutputsAreArrays) {
            combinedData = outputs.flatMap(o => o.output);
        } else if (allOutputsAreObjects) {
            combinedData = Object.assign({}, ...outputs.map(o => o.output));
        } else {
            combinedData = outputs.map(o => (o.output !== null && o.output !== undefined) ? o.output : o.stdout);
        }

        const successfulTasks = outputs.filter(o => o.exitCode === 0).length;
        const failedTasks = outputs.filter(o => o.exitCode !== 0).length;

        return {
            jobId: job.jobId,
            type: "SCRIPT",
            scriptName: job.parameters.scriptName,
            taskCount: job.taskIds.length,
            totalTasks: job.taskIds.length,
            completedTaskCount: taskResults.length,
            successfulTasks,
            failedTasks,
            totalExecutionTimeMs,
            executionTimeMs: totalExecutionTimeMs,
            summary: {
                totalExecutionTimeMs,
                allTasksSuccessful: failedTasks === 0
            },
            tasks: outputs,
            combinedOutput: combinedData,
            completedAt: Date.now()
        };
    }

    // ====================================
    // Get Job Result
    // ====================================

    getJobResult(jobId) {
        const job =
            this.jobManager.getJob(jobId);

        if (!job) {
            return null;
        }

        if (job.status !== "COMPLETED") {
            return null;
        }

        return this.aggregateJobResults(
            job
        );
    }
}

module.exports = {
    ResultAggregator
};