const assert = require("assert");

// Import modules
const { isPrime, calculatePrimes, calculatePrimesAsync, executePrimeTask } = require("../peer/compute/primeTask");
const { executeTask } = require("../peer/compute/executor");
const { PeerTable } = require("../peer/peer/peerTable");
const { TaskManager } = require("../peer/jobs/taskManager");
const { JobManager } = require("../peer/jobs/jobManager");
const { Scheduler } = require("../peer/scheduler/scheduler");
const { ResultAggregator } = require("../peer/jobs/resultAggregator");
const { TaskRecovery, MAX_TASK_RETRIES } = require("../peer/recovery/taskRecovery");
const { startTCPServer } = require("../peer/network/tcpServer");
const { sendTCPMessage } = require("../peer/network/tcpClient");
const { MESSAGE_TYPES } = require("../peer/network/protocol");

let passed = 0;
let failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  [PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`  [FAIL] ${name}: ${err.message}`);
        console.error(err.stack);
        failed++;
    }
}

async function runTests() {
    console.log("========================================");
    console.log("     RUNNING COMPUTEMESH UNIT TESTS     ");
    console.log("========================================");

    // 1. Prime Task & Executor Tests
    console.log("\n--- Compute & Prime Tests ---");
    await test("isPrime correctly identifies prime and non-prime numbers", () => {
        assert.strictEqual(isPrime(-5), false);
        assert.strictEqual(isPrime(0), false);
        assert.strictEqual(isPrime(1), false);
        assert.strictEqual(isPrime(2), true);
        assert.strictEqual(isPrime(3), true);
        assert.strictEqual(isPrime(4), false);
        assert.strictEqual(isPrime(29), true);
        assert.strictEqual(isPrime(100), false);
    });

    await test("calculatePrimes matches known prime counts", () => {
        const primes100 = calculatePrimes(1, 100);
        assert.strictEqual(primes100.length, 25);
        const primes1000 = calculatePrimes(1, 1000);
        assert.strictEqual(primes1000.length, 168);
    });

    await test("executePrimeTask and executeTask work asynchronously without blocking", async () => {
        const task = { taskId: "T-01", type: "PRIME", start: 1, end: 50 };
        const result = await executeTask(task);
        assert.strictEqual(result.taskId, "T-01");
        assert.strictEqual(result.count, 15);
        assert(result.totalExecutionTimeMs >= 0);
    });

    await test("executePrimeTask throws on invalid input", async () => {
        let threw = false;
        try {
            await executePrimeTask({ taskId: "T-ERR", start: 100, end: 50 });
        } catch (_) {
            threw = true;
        }
        assert.strictEqual(threw, true);
    });

    // 2. Scheduler Load Balancing Tests
    console.log("\n--- Scheduler Tests ---");
    await test("Scheduler balances tasks evenly across peers (fixes Bug 5)", () => {
        const peerTable = new PeerTable("P-LOCAL");
        peerTable.addPeer({ peerId: "P-1", status: "ONLINE", freeMemoryGB: "4.5" }, true);
        peerTable.addPeer({ peerId: "P-2", status: "ONLINE", freeMemoryGB: "4.0" }, true);

        const jobManager = new JobManager();
        const taskManager = new TaskManager(jobManager);
        const scheduler = new Scheduler(peerTable, taskManager);

        const tasks = [
            taskManager.createTask("JOB-01", "PRIME", { start: 1, end: 25 }),
            taskManager.createTask("JOB-01", "PRIME", { start: 26, end: 50 }),
            taskManager.createTask("JOB-01", "PRIME", { start: 51, end: 75 }),
            taskManager.createTask("JOB-01", "PRIME", { start: 76, end: 100 })
        ];

        const assignments = scheduler.scheduleTasks(tasks);
        assert.strictEqual(assignments.length, 4);

        const countP1 = assignments.filter(a => a.peerId === "P-1").length;
        const countP2 = assignments.filter(a => a.peerId === "P-2").length;

        // Must be evenly split: 2 and 2, not 3 and 1!
        assert.strictEqual(countP1, 2, `Expected P-1 to have 2 tasks, got ${countP1}`);
        assert.strictEqual(countP2, 2, `Expected P-2 to have 2 tasks, got ${countP2}`);
    });

    await test("Scheduler considers active tasks from taskManager (fixes Bug 6)", () => {
        const peerTable = new PeerTable("P-LOCAL");
        peerTable.addPeer({ peerId: "P-1", status: "ONLINE", freeMemoryGB: "4.5" }, true);
        peerTable.addPeer({ peerId: "P-2", status: "ONLINE", freeMemoryGB: "4.0" }, true);

        const jobManager = new JobManager();
        const taskManager = new TaskManager(jobManager);
        const scheduler = new Scheduler(peerTable, taskManager);

        // Pre-assign an active task to P-1
        const preTask = taskManager.createTask("JOB-PRE", "PRIME", { start: 1, end: 10 });
        taskManager.updateTask(preTask.taskId, { status: "ASSIGNED", assignedPeerId: "P-1" });

        // Now schedule 1 task; P-2 should be picked because P-1 already has 1 active task
        const newTask = taskManager.createTask("JOB-02", "PRIME", { start: 11, end: 20 });
        const assignments = scheduler.scheduleTasks([newTask]);

        assert.strictEqual(assignments[0].peerId, "P-2", "Should pick P-2 to balance existing active load");
    });

    // 3. Task Recovery Tests
    console.log("\n--- Recovery Tests ---");
    await test("TaskRecovery respects MAX_TASK_RETRIES and prevents infinite loops (fixes Bug 3)", () => {
        const peerTable = new PeerTable("P-LOCAL");
        const jobManager = new JobManager();
        const taskManager = new TaskManager(jobManager);
        const scheduler = new Scheduler(peerTable, taskManager);
        const distributor = { distributeTasks: async () => [] };
        const recovery = new TaskRecovery(peerTable, taskManager, scheduler, distributor);

        const task = taskManager.createTask("JOB-01", "PRIME", { start: 1, end: 100 });
        taskManager.updateTask(task.taskId, { status: "ASSIGNED", assignedPeerId: "P-DEAD", retryCount: MAX_TASK_RETRIES });

        const recovered = recovery.recoverTasksFromPeer("P-DEAD");
        assert.strictEqual(recovered.length, 0, "Task exceeding max retries should not be recoverable");

        const updated = taskManager.getTask(task.taskId);
        assert.strictEqual(updated.status, "FAILED");
    });

    await test("TaskRecovery properly resets recoverable task to PENDING and increments retryCount", () => {
        const peerTable = new PeerTable("P-LOCAL");
        const jobManager = new JobManager();
        const taskManager = new TaskManager(jobManager);
        const scheduler = new Scheduler(peerTable, taskManager);
        const distributor = { distributeTasks: async () => [] };
        const recovery = new TaskRecovery(peerTable, taskManager, scheduler, distributor);

        const task = taskManager.createTask("JOB-01", "PRIME", { start: 1, end: 100 });
        taskManager.updateTask(task.taskId, { status: "ASSIGNED", assignedPeerId: "P-DEAD", retryCount: 0 });

        const recovered = recovery.recoverTasksFromPeer("P-DEAD");
        assert.strictEqual(recovered.length, 1);
        assert.strictEqual(recovered[0].retryCount, 1);
        assert.strictEqual(taskManager.getTask(task.taskId).status, "PENDING");
    });

    // 4. Result Aggregator Tests
    console.log("\n--- Result Aggregator & Job Manager Tests ---");
    await test("ResultAggregator attaches finalResult and executionTimeMs to job object (fixes Bug 17)", () => {
        const jobManager = new JobManager();
        const taskManager = new TaskManager(jobManager);
        const aggregator = new ResultAggregator(jobManager, taskManager);

        const job = jobManager.createJob("PRIME", { start: 1, end: 100, taskCount: 2 });
        const t1 = taskManager.createTask(job.jobId, "PRIME", { start: 1, end: 50 });
        const t2 = taskManager.createTask(job.jobId, "PRIME", { start: 51, end: 100 });

        aggregator.addTaskResult(t1.taskId, { taskId: t1.taskId, primes: [2, 3, 5], executionTimeMs: 10 });
        assert.strictEqual(job.status, "CREATED"); // not yet finished

        const finalResult = aggregator.addTaskResult(t2.taskId, { taskId: t2.taskId, primes: [53, 59], executionTimeMs: 15 });
        assert(finalResult !== null);
        assert.strictEqual(job.status, "COMPLETED");
        assert.strictEqual(job.result.primeCount, 5);
        assert.strictEqual(job.executionTimeMs, 25);
    });

    await test("ResultAggregator ignores duplicate results for already completed tasks (fixes Bug 19)", () => {
        const jobManager = new JobManager();
        const taskManager = new TaskManager(jobManager);
        const aggregator = new ResultAggregator(jobManager, taskManager);

        const job = jobManager.createJob("PRIME", { start: 1, end: 10 });
        const t1 = taskManager.createTask(job.jobId, "PRIME", { start: 1, end: 10 });

        aggregator.addTaskResult(t1.taskId, { taskId: t1.taskId, primes: [2, 3, 5, 7], executionTimeMs: 5 });
        // Send duplicate result
        aggregator.addTaskResult(t1.taskId, { taskId: t1.taskId, primes: [2, 3, 5, 7], executionTimeMs: 5 });

        assert.strictEqual(job.results.length, 1, "Duplicate result should not be appended");
    });

    // 5. TCP Client / Server Tests
    console.log("\n--- TCP Client & Server Tests ---");
    await test("TCP Server and Client communication with clean response handling", async () => {
        const testPort = 5991;
        const server = startTCPServer("TEST-PEER", testPort, (msg, socket) => {
            if (msg.type === "PING") {
                socket.write(JSON.stringify({ type: "PONG" }) + "\n");
            }
        });

        await new Promise(r => setTimeout(r, 200));

        const res = await sendTCPMessage("127.0.0.1", testPort, { type: "PING" }, 5000);
        assert.strictEqual(res.type, "PONG");

        await new Promise((resolve) => server.close(resolve));
    });

    await test("TCP Client rejects cleanly on connection refused without hanging", async () => {
        let threw = false;
        try {
            await sendTCPMessage("127.0.0.1", 5999, { type: "PING" }, 1000);
        } catch (_) {
            threw = true;
        }
        assert.strictEqual(threw, true);
    });

    console.log("\n========================================");
    console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
    console.log("========================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Test runner crashed:", err);
    process.exit(1);
});
