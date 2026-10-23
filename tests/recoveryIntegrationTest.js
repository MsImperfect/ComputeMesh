const assert = require("assert");

const { PeerTable } = require("../peer/peer/peerTable");
const { JobManager } = require("../peer/jobs/jobManager");
const { TaskManager } = require("../peer/jobs/taskManager");
const { ResultAggregator } = require("../peer/jobs/resultAggregator");
const { Scheduler } = require("../peer/scheduler/scheduler");
const { TaskRecovery } = require("../peer/recovery/taskRecovery");
const { executeTask } = require("../peer/compute/executor");

async function testWorkerCrashAndRecovery() {
    console.log("========================================");
    console.log("   TEST: WORKER CRASH & TASK RECOVERY   ");
    console.log("========================================");

    const peerTable = new PeerTable("COORDINATOR");
    peerTable.addPeer({ peerId: "WORKER-1", status: "ONLINE", freeMemoryGB: "8.0" }, true);
    peerTable.addPeer({ peerId: "WORKER-2", status: "ONLINE", freeMemoryGB: "8.0" }, true);

    const jobManager = new JobManager();
    const taskManager = new TaskManager(jobManager);
    const aggregator = new ResultAggregator(jobManager, taskManager);
    const scheduler = new Scheduler(peerTable, taskManager);

    // Mock distributor that routes tasks to mock workers
    let worker2Online = true;
    const distributor = {
        distributeTasks: async (tasks, assignments) => {
            const results = [];
            for (const { taskId, peerId } of assignments) {
                if (peerId === "WORKER-2" && !worker2Online) {
                    // Worker 2 is down/crashed
                    taskManager.updateTask(taskId, {
                        status: "PENDING",
                        assignedPeerId: null,
                        error: "Connection refused (worker offline)"
                    });
                    continue;
                }

                // Simulate task execution
                const task = taskManager.getTask(taskId);
                const res = await executeTask(task);
                aggregator.addTaskResult(taskId, res);
                results.push(res);
            }
            return results;
        }
    };

    const recovery = new TaskRecovery(peerTable, taskManager, scheduler, distributor);

    // 1. Create Job with 4 tasks
    const job = jobManager.createJob("PRIME", { start: 1, end: 100, taskCount: 4 });
    const tasks = taskManager.splitPrimeJob(job);
    assert.strictEqual(tasks.length, 4);

    // 2. Schedule tasks across both workers
    const initialAssignments = scheduler.scheduleTasks(tasks);
    assert.strictEqual(initialAssignments.length, 4);

    const w1Initial = initialAssignments.filter(a => a.peerId === "WORKER-1").length;
    const w2Initial = initialAssignments.filter(a => a.peerId === "WORKER-2").length;
    assert.strictEqual(w1Initial, 2);
    assert.strictEqual(w2Initial, 2);
    console.log(`[TEST] Initial scheduling: Worker-1 got ${w1Initial} tasks, Worker-2 got ${w2Initial} tasks`);

    // 3. Worker-1 completes its 2 tasks; Worker-2 crashes
    worker2Online = false;
    const w1Tasks = initialAssignments.filter(a => a.peerId === "WORKER-1");
    for (const { taskId } of w1Tasks) {
        const t = taskManager.getTask(taskId);
        const res = await executeTask(t);
        aggregator.addTaskResult(taskId, res);
    }

    assert.strictEqual(job.results.length, 2);
    assert.strictEqual(job.status, "CREATED"); // job not finished yet
    console.log(`[TEST] Worker-1 completed 2 tasks. Worker-2 has crashed.`);

    // 4. Mark Worker-2 OFFLINE in peer table
    peerTable.getPeer("WORKER-2").status = "OFFLINE";

    // 5. Trigger task recovery for Worker-2
    const recoveredTasks = recovery.recoverTasksFromPeer("WORKER-2");
    assert.strictEqual(recoveredTasks.length, 2);
    console.log(`[TEST] Recovered ${recoveredTasks.length} tasks from Worker-2`);

    // 6. Redistribute recovered tasks to available workers (Worker-1)
    const redistributedResults = await recovery.redistributeTasks(recoveredTasks);
    assert.strictEqual(redistributedResults.length, 2);
    console.log(`[TEST] Successfully redistributed and executed ${redistributedResults.length} tasks on Worker-1`);

    // 7. Verify Job Completion
    assert.strictEqual(job.status, "COMPLETED");
    assert.strictEqual(job.results.length, 4);
    assert.strictEqual(job.result.primeCount, 25);
    console.log(`[TEST] Job ${job.jobId} completed successfully! Prime count: ${job.result.primeCount}`);

    console.log("\n[PASS] WORKER CRASH & TASK RECOVERY TEST PASSED!");
}

testWorkerCrashAndRecovery().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
