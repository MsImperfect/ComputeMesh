// ========================================
// Task Distributor
// ========================================

const { sendTCPMessage } = require("../network/tcpClient");
const { MESSAGE_TYPES } = require("../network/protocol");

class TaskDistributor {
    constructor(peerTable, taskManager, resultAggregator) {
        this.peerTable = peerTable;
        this.taskManager = taskManager;
        this.resultAggregator = resultAggregator;
    }

    /**
     * Distribute tasks to peers based on assignments.
     * @param {Array} tasks - List of task objects from TaskManager.
     * @param {Array} assignments - [{taskId, peerId}] from Scheduler.
     * @returns {Promise<Array>} - Array of results collected from peers.
     */
    async distributeTasks(tasks, assignments) {
        if (!Array.isArray(tasks) || !Array.isArray(assignments)) {
            throw new Error("Invalid arguments to distributeTasks");
        }
        const results = [];
        const taskMap = new Map();
        tasks.forEach(t => taskMap.set(t.taskId, t));
        for (const { taskId, peerId } of assignments) {
            const peerInfo = this.peerTable.getPeer(peerId);
            if (!peerInfo) {
                console.error(`[DISTRIBUTOR] Peer ${peerId} not found for task ${taskId}`);
                continue;
            }
            const task = taskMap.get(taskId);
            if (!task) {
                console.error(`[DISTRIBUTOR] Task ${taskId} not found`);
                continue;
            }
            const message = {
                type: MESSAGE_TYPES.TASK,
                task: task
            };
            try {
                const response = await sendTCPMessage(peerInfo.ipAddress, peerInfo.tcpPort, message);
                if (response && response.type === MESSAGE_TYPES.TASK_RESULT) {
                    // Forward only the result payload to the aggregator and collector
                    this.resultAggregator.addTaskResult(taskId, response.result);
                    results.push(response.result);
                } else {
                    console.error(`[DISTRIBUTOR] Unexpected response for task ${taskId} from ${peerId}`);
                }
            } catch (err) {
                console.error(`[DISTRIBUTOR] Failed to send task ${taskId} to ${peerId}: ${err.message}`);
                // Task remains PENDING; recovery will handle it later.
            }
        }
        return results;
    }
}

module.exports = { TaskDistributor };
