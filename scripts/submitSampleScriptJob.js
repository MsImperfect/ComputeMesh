// scripts/submitSampleScriptJob.js
const http = require('http');

const payload = JSON.stringify({
    scriptName: "model.py",
    scriptContent: `
import csv
import json

with open("data.csv", "r", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

count = len(rows)
values = [float(r.get("score", 0)) for r in rows]
mean_score = sum(values) / len(values) if values else 0.0

print(f"[WORKER SCRIPT] Processed {count} records. Mean score: {mean_score}")

output = {
    "recordsProcessed": count,
    "meanScore": mean_score,
    "status": "COMPLETED"
}

with open("result.json", "w", encoding="utf-8") as out:
    json.dump(output, out, indent=2)
`,
    files: [
        {
            filename: "data.csv",
            content: "id,score\n1,95\n2,88\n3,72\n4,91\n5,84\n6,79\n7,93\n8,87"
        }
    ],
    taskCount: 2,
    splitCsv: true
});

const req = http.request("http://localhost:3000/api/submit-script-job", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
    }
}, res => {
    let body = "";
    res.on("data", chunk => body += chunk);
    res.on("end", () => {
        console.log("Response:", body);
    });
});

req.on("error", err => console.error("Request error:", err));
req.write(payload);
req.end();
