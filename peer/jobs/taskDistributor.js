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
     * Distribute tasks to peers based on assignments concurrently.
     * @param {Array} tasks - List of task objects from TaskManager.
     * @param {Array} assignments - [{taskId, peerId}] from Scheduler.
     * @returns {Promise<Array>} - Array of results collected from peers.
     */
    async distributeTasks(tasks, assignments) {
        if (!Array.isArray(tasks) || !Array.isArray(assignments)) {
            throw new Error("Invalid arguments to distributeTasks");
        }

        const taskMap = new Map();
        tasks.forEach(t => taskMap.set(t.taskId, t));

        const dispatchPromises = assignments.map(async ({ taskId, peerId }) => {
            const peerInfo = this.peerTable.getPeer(peerId);
            if (!peerInfo) {
                console.error(`[DISTRIBUTOR] Peer ${peerId} not found for task ${taskId}`);
                this.taskManager.updateTask(taskId, {
                    status: "PENDING",
                    assignedPeerId: null,
                    startedAt: null,
                    error: `Peer ${peerId} not found`
                });
                return null;
            }

            const task = taskMap.get(taskId);
            if (!task) {
                console.error(`[DISTRIBUTOR] Task ${taskId} not found`);
                return null;
            }

            // Transition task to RUNNING
            this.taskManager.updateTask(taskId, {
                status: "RUNNING",
                assignedPeerId: peerId,
                startedAt: Date.now()
            });

            const message = {
                type: MESSAGE_TYPES.TASK,
                task: {
                    ...task,
                    status: "RUNNING",
                    assignedPeerId: peerId
                }
            };

            try {
                const response = await sendTCPMessage(peerInfo.ipAddress, peerInfo.tcpPort, message);
                if (response && response.type === MESSAGE_TYPES.TASK_RESULT) {
                    this.resultAggregator.addTaskResult(taskId, response.result);
                    return response.result;
                } else {
                    const errMsg = (response && response.message) || `Unexpected response (${response ? response.type : 'none'})`;
                    console.error(`[DISTRIBUTOR] Error response for task ${taskId} from ${peerId}: ${errMsg}`);
                    this.taskManager.updateTask(taskId, {
                        status: "PENDING",
                        assignedPeerId: null,
                        startedAt: null,
                        error: errMsg
                    });
                    return null;
                }
            } catch (err) {
                console.error(`[DISTRIBUTOR] Failed to send task ${taskId} to ${peerId}: ${err.message}`);
                this.taskManager.updateTask(taskId, {
                    status: "PENDING",
                    assignedPeerId: null,
                    startedAt: null,
                    error: err.message
                });
                return null;
            }
        });

        const allResults = await Promise.all(dispatchPromises);
        return allResults.filter(Boolean);
    }
}

module.exports = { TaskDistributor };
