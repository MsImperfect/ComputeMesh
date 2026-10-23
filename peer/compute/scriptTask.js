// ========================================
// ComputeMesh Script & File Task Executor
// ========================================

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn, spawnSync } = require("child_process");

let cachedPythonCmd = null;

function detectPythonCommand() {
    if (cachedPythonCmd) return cachedPythonCmd;

    // Check py launcher on Windows first
    try {
        const py = spawnSync("py", ["--version"]);
        if (py.status === 0) {
            cachedPythonCmd = "py";
            return "py";
        }
    } catch (_) {}

    // Check python
    try {
        const python = spawnSync("python", ["--version"]);
        if (python.status === 0) {
            cachedPythonCmd = "python";
            return "python";
        }
    } catch (_) {}

    // Check python3
    try {
        const python3 = spawnSync("python3", ["--version"]);
        if (python3.status === 0) {
            cachedPythonCmd = "python3";
            return "python3";
        }
    } catch (_) {}

    return "python";
}

function resolveRuntime(runtime, scriptName) {
    if (runtime) {
        const r = String(runtime).toLowerCase();
        if (r === "python" || r === "py") {
            return detectPythonCommand();
        }
        if (r === "node" || r === "javascript" || r === "js") {
            return process.execPath;
        }
        return runtime;
    }

    const ext = path.extname(scriptName).toLowerCase();
    if (ext === ".py") {
        return detectPythonCommand();
    }
    if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
        return process.execPath;
    }

    return detectPythonCommand();
}

/**
 * Execute an arbitrary script (e.g. model.py) with associated files (e.g. data.csv)
 * in an isolated temporary working directory.
 */
async function executeScriptTask(task) {
    if (!task) {
        throw new Error("Cannot execute empty script task");
    }

    const taskId = task.taskId || `TASK-${Date.now()}`;
    const scriptName = task.scriptName || task.entrypoint || "model.py";
    const scriptContent = task.scriptContent || "";
    const files = Array.isArray(task.files) ? task.files : [];
    const args = Array.isArray(task.args) ? task.args : [];
    const timeoutMs = Number(task.timeoutMs) || 60000;

    // Create an isolated task directory in temp
    const baseDir = path.join(os.tmpdir(), "computemesh-tasks");
    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
    }
    const taskDir = path.join(baseDir, taskId);
    if (!fs.existsSync(taskDir)) {
        fs.mkdirSync(taskDir, { recursive: true });
    }

    try {
        // Write the main script file
        const scriptPath = path.join(taskDir, scriptName);
        fs.writeFileSync(scriptPath, scriptContent, "utf8");

        // Write all auxiliary files (e.g. data.csv, config, weights)
        for (const file of files) {
            if (file && file.name) {
                const filePath = path.join(taskDir, file.name);
                const fileDir = path.dirname(filePath);
                if (!fs.existsSync(fileDir)) {
                    fs.mkdirSync(fileDir, { recursive: true });
                }
                const content = file.content !== undefined ? file.content : "";
                const encoding = file.encoding === "base64" ? "base64" : "utf8";
                fs.writeFileSync(filePath, content, encoding);
            }
        }

        const command = resolveRuntime(task.runtime, scriptName);
        const cliArgs = [scriptName, ...args];

        console.log("");
        console.log("========================================");
        console.log("       SCRIPT & FILE TASK EXECUTOR      ");
        console.log("========================================");
        console.log(`Task ID:        ${taskId}`);
        console.log(`Script:         ${scriptName}`);
        console.log(`Command:        ${command} ${cliArgs.join(" ")}`);
        console.log(`Files count:    ${files.length}`);
        if (files.length > 0) {
            console.log(`Files:          ${files.map(f => f.name).join(", ")}`);
        }
        console.log(`Working Dir:    ${taskDir}`);
        console.log("----------------------------------------");

        const startTime = Date.now();

        const executionResult = await new Promise((resolve, reject) => {
            let stdout = "";
            let stderr = "";
            let isDone = false;

            const child = spawn(command, cliArgs, {
                cwd: taskDir,
                env: {
                    ...process.env,
                    ...(task.env || {}),
                    PYTHONUNBUFFERED: "1"
                }
            });

            child.stdout.on("data", (data) => {
                const chunk = data.toString();
                stdout += chunk;
                process.stdout.write(`[${taskId} STDOUT] ${chunk}`);
            });

            child.stderr.on("data", (data) => {
                const chunk = data.toString();
                stderr += chunk;
                process.stderr.write(`[${taskId} STDERR] ${chunk}`);
            });

            const timer = setTimeout(() => {
                if (!isDone) {
                    isDone = true;
                    try { child.kill("SIGKILL"); } catch (_) {}
                    reject(new Error(`Script execution timed out after ${timeoutMs}ms`));
                }
            }, timeoutMs);

            child.on("error", (err) => {
                if (!isDone) {
                    isDone = true;
                    clearTimeout(timer);
                    reject(err);
                }
            });

            child.on("close", (code) => {
                if (!isDone) {
                    isDone = true;
                    clearTimeout(timer);
                    resolve({ exitCode: code, stdout, stderr });
                }
            });
        });

        const executionTimeMs = Date.now() - startTime;

        // Check if output files were generated (e.g. output.json or output.csv)
        let output = null;
        let generatedFiles = [];
        const possibleOutputFiles = ["output.json", "result.json", "output.csv", "result.csv", "result.txt", "output.txt"];
        for (const outName of possibleOutputFiles) {
            const outPath = path.join(taskDir, outName);
            if (fs.existsSync(outPath)) {
                try {
                    const raw = fs.readFileSync(outPath, "utf8");
                    generatedFiles.push({ name: outName, content: raw });
                    if (output === null) {
                        if (outName.endsWith(".json")) {
                            output = JSON.parse(raw);
                        } else {
                            output = raw;
                        }
                    }
                } catch (_) {}
            }
        }

        // If no file output, try parsing stdout as JSON
        if (output === null && executionResult.stdout.trim()) {
            try {
                output = JSON.parse(executionResult.stdout.trim());
            } catch (_) {
                output = executionResult.stdout.trim();
            }
        }

        console.log(`Execution Time: ${executionTimeMs} ms`);
        console.log(`Exit Code:      ${executionResult.exitCode}`);
        console.log("========================================");
        console.log("");

        if (executionResult.exitCode !== 0) {
            throw new Error(`Script exited with code ${executionResult.exitCode}: ${executionResult.stderr || executionResult.stdout}`);
        }

        return {
            taskId,
            type: "SCRIPT",
            scriptName,
            exitCode: executionResult.exitCode,
            stdout: executionResult.stdout,
            stderr: executionResult.stderr,
            output,
            outputData: output,
            generatedFiles,
            executionTimeMs
        };

    } finally {
        // Clean up temporary workspace directory
        try {
            fs.rmSync(taskDir, { recursive: true, force: true });
        } catch (_) {}
    }
}

module.exports = {
    executeScriptTask,
    detectPythonCommand,
    resolveRuntime
};
