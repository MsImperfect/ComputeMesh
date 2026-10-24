// tests/twoPeersScriptIntegrationTest.js
// Tests end-to-end distributed script execution (model.py + data.csv) across 2 P2P nodes over TCP/UDP

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

function postJson(url, data) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const payload = JSON.stringify(data);
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname,
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(payload)
            }
        }, (res) => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve(body);
                }
            });
        });
        req.on("error", reject);
        req.write(payload);
        req.end();
    });
}

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let body = "";
            res.on("data", chunk => body += chunk);
            res.on("end", () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve(body);
                }
            });
        }).on("error", reject);
    });
}

const samplePythonScript = `# model.py - Distributed ML / statistical calculation
import csv
import json
import sys

with open("data.csv", "r", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

count = len(rows)
values = [float(r.get("val", 0)) for r in rows]
avg = sum(values) / len(values) if values else 0.0

print(f"[WORKER] Processed {count} items. Average value = {avg}")

result = {
    "count": count,
    "average": round(avg, 2),
    "status": "SUCCESS"
}

with open("result.json", "w", encoding="utf-8") as out:
    json.dump(result, out)
`;

const sampleCsv = `id,val\n1,10\n2,20\n3,30\n4,40\n5,50\n6,60\n7,70\n8,80`;

async function run() {
    console.log("=== Launching 2 ComputeMesh Nodes for Script Task Test ===");

    const peerA = spawn(process.execPath, [path.resolve(__dirname, "../peer/index.js")], {
        env: {
            ...process.env,
            PEER_ID: "PEER-ALPHA",
            PORT: "5010",
            UDP_PORT: "6010",
            HTTP_PORT: "3010",
            ALLOW_SAME_HOST_PEERS: "true",
            HEARTBEAT_INTERVAL: "1000",
            DISCOVERY_INTERVAL: "1500"
        },
        stdio: ["ignore", "pipe", "pipe"]
    });

    const peerB = spawn(process.execPath, [path.resolve(__dirname, "../peer/index.js")], {
        env: {
            ...process.env,
            PEER_ID: "PEER-BETA",
            PORT: "5011",
            UDP_PORT: "6011",
            HTTP_PORT: "3011",
            ALLOW_SAME_HOST_PEERS: "true",
            HEARTBEAT_INTERVAL: "1000",
            DISCOVERY_INTERVAL: "1500"
        },
        stdio: ["ignore", "pipe", "pipe"]
    });

    peerA.stdout.on("data", d => process.stdout.write(`[ALPHA] ${d}`));
    peerB.stdout.on("data", d => process.stdout.write(`[BETA]  ${d}`));

    const cleanup = () => {
        try { peerA.kill(); } catch (_) {}
        try { peerB.kill(); } catch (_) {}
    };

    process.on("exit", cleanup);
    process.on("SIGINT", cleanup);

    // Wait for nodes to start and discover each other
    console.log("Waiting 4 seconds for nodes to discover each other...");
    await new Promise(r => setTimeout(r, 4000));

    // Submit script job to Peer A
    console.log("Submitting script job to Peer A (http://127.0.0.1:3010/api/submit-script-job)...");
    const submitRes = await postJson("http://127.0.0.1:3010/api/submit-script-job", {
        scriptName: "model.py",
        scriptContent: samplePythonScript,
        files: [{ filename: "data.csv", content: sampleCsv }],
        taskCount: 2,
        splitCsv: true
    });

    console.log("Submission response:", submitRes);
    if (!submitRes.success) {
        throw new Error("Failed to submit script job: " + submitRes.error);
    }

    const jobId = submitRes.jobId;

    // Poll status until completion
    let completed = false;
    for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const status = await getJson("http://127.0.0.1:3010/status");
        const job = (status.jobs || []).find(j => j.jobId === jobId);
        if (job) {
            console.log(`Job status: ${job.status}`);
            if (job.status === "COMPLETED") {
                console.log("\n JOB COMPLETED SUCCESSFULLY ACROSS MESH!");
                console.log("Result Summary:", JSON.stringify(job.result, null, 2));
                completed = true;
                break;
            } else if (job.status === "FAILED") {
                throw new Error("Job failed on mesh: " + job.error);
            }
        }
    }

    cleanup();

    if (!completed) {
        throw new Error("Timed out waiting for script job completion");
    }

    console.log("\n Distributed Script Job Test PASSED!");
    process.exit(0);
}

run().catch(err => {
    console.error("Test error:", err);
    process.exit(1);
});
