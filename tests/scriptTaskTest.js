// tests/scriptTaskTest.js
// Verification of distributed script execution (e.g. model.py + data.csv)
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { TaskManager } = require("../peer/jobs/taskManager");
const { ResultAggregator } = require("../peer/jobs/resultAggregator");
const { executeScriptTask, detectPythonCommand } = require("../peer/compute/scriptTask");
const { JobManager } = require("../peer/jobs/jobManager");

async function runTests() {
    console.log("=== Testing Script Task Execution Architecture ===");

    // Test 1: Python detection
    const pythonCmd = detectPythonCommand();
    console.log(`[TEST 1] Detected Python command: "${pythonCmd || 'NOT FOUND'}"`);

    // Test 2: TaskManager splitScriptJob
    console.log("[TEST 2] Testing CSV dataset partitioning across tasks...");
    const jobManager = new JobManager();
    const taskManager = new TaskManager(jobManager);

    const sampleCsv = `id,feature_x,feature_y\n1,10,20\n2,30,40\n3,50,60\n4,70,80\n5,90,100\n6,110,120`;
    const sampleScript = `# Simple Python model test
import csv
import json

with open("data.csv", "r") as f:
    rows = list(csv.DictReader(f))

total = sum(float(r["feature_x"]) for r in rows)
result = {"rowCount": len(rows), "sumX": total}
print(f"Worker calculated rowCount={len(rows)} sumX={total}")

with open("result.json", "w") as out:
    json.dump(result, out)
`;

    const job = jobManager.createJob("SCRIPT", {
        scriptName: "model.py",
        scriptContent: sampleScript,
        files: [{ filename: "data.csv", content: sampleCsv }],
        taskCount: 2,
        splitCsv: true
    });

    const tasks = taskManager.splitScriptJob(job);
    assert.strictEqual(tasks.length, 2, "Job should split into 2 tasks");
    assert.strictEqual(tasks[0].type, "SCRIPT");
    assert.strictEqual(tasks[1].type, "SCRIPT");
    assert.strictEqual(tasks[0].sliceIndex, 0);
    assert.strictEqual(tasks[1].sliceIndex, 1);

    // Verify both slices retain CSV header
    const slice0Csv = tasks[0].files.find(f => f.filename === "data.csv").content;
    const slice1Csv = tasks[1].files.find(f => f.filename === "data.csv").content;

    assert.ok(slice0Csv.startsWith("id,feature_x,feature_y"), "Slice 0 must have CSV header");
    assert.ok(slice1Csv.startsWith("id,feature_x,feature_y"), "Slice 1 must have CSV header");

    const lines0 = slice0Csv.trim().split("\n");
    const lines1 = slice1Csv.trim().split("\n");

    console.log(`Slice 0 lines: ${lines0.length} (header + 3 data rows)`);
    console.log(`Slice 1 lines: ${lines1.length} (header + 3 data rows)`);
    assert.strictEqual(lines0.length, 4, "Slice 0 has 1 header + 3 rows");
    assert.strictEqual(lines1.length, 4, "Slice 1 has 1 header + 3 rows");
    console.log("-> TaskManager CSV partitioning PASSED.");

    // Test 3: Execute tasks
    console.log("[TEST 3] Executing SCRIPT tasks...");
    const res0 = await executeScriptTask(tasks[0]);
    console.log(`Task 0 output: exitCode=${res0.exitCode}, stdout="${res0.stdout.trim()}"`);
    assert.strictEqual(res0.exitCode, 0, "Task 0 should exit with code 0");
    assert.ok(res0.outputData, "Task 0 should parse result.json");
    assert.strictEqual(res0.outputData.rowCount, 3, "Task 0 should process 3 rows");

    const res1 = await executeScriptTask(tasks[1]);
    console.log(`Task 1 output: exitCode=${res1.exitCode}, stdout="${res1.stdout.trim()}"`);
    assert.strictEqual(res1.exitCode, 0, "Task 1 should exit with code 0");
    assert.ok(res1.outputData, "Task 1 should parse result.json");
    assert.strictEqual(res1.outputData.rowCount, 3, "Task 1 should process 3 rows");
    console.log("-> Script execution with Python PASSED.");

    // Test 4: Result Aggregation
    console.log("[TEST 4] Testing ResultAggregator on SCRIPT job...");
    const aggregator = new ResultAggregator();
    job.results = [
        { taskId: tasks[0].taskId, ...res0 },
        { taskId: tasks[1].taskId, ...res1 }
    ];

    const aggregated = aggregator.aggregateScriptResults(job);
    assert.strictEqual(aggregated.totalTasks, 2);
    assert.strictEqual(aggregated.successfulTasks, 2);
    assert.strictEqual(aggregated.failedTasks, 0);
    assert.strictEqual(aggregated.summary.allTasksSuccessful, true);
    assert.strictEqual(aggregated.tasks.length, 2);
    console.log("-> Script Result Aggregation PASSED.");

    console.log("\n ALL SCRIPT TASK TESTS PASSED!");
}

runTests().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
