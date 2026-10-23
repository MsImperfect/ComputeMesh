const net = require("net");

function sendTCPMessage(host, port, message, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();
        let buffer = "";
        let settled = false;

        const cleanupAndReject = (err) => {
            if (!settled) {
                settled = true;
                socket.destroy();
                reject(err);
            }
        };

        const cleanupAndResolve = (value) => {
            if (!settled) {
                settled = true;
                socket.end();
                resolve(value);
            }
        };

        socket.setTimeout(timeoutMs);

        socket.connect(port, host, () => {
            console.log(`[TCP] Connected to ${host}:${port}`);
            const data = JSON.stringify(message) + "\n";
            console.log(`[TCP] Sending: ${data.trim()}`);
            socket.write(data);
        });

        socket.on("data", (data) => {
            buffer += data.toString();
            const messages = buffer.split("\n");
            buffer = messages.pop();

            for (const rawMessage of messages) {
                if (!rawMessage.trim()) {
                    continue;
                }

                console.log(`[TCP] Response: ${rawMessage}`);

                try {
                    const response = JSON.parse(rawMessage);
                    cleanupAndResolve(response);
                    return;
                } catch (error) {
                    cleanupAndReject(
                        new Error(`Invalid TCP response: ${error.message}`)
                    );
                    return;
                }
            }
        });

        socket.on("timeout", () => {
            cleanupAndReject(
                new Error(`TCP connection timed out after ${timeoutMs}ms`)
            );
        });

        socket.on("error", (error) => {
            cleanupAndReject(error);
        });

        socket.on("close", () => {
            console.log("[TCP] Connection closed");
            if (!settled) {
                cleanupAndReject(
                    new Error("TCP connection closed without response")
                );
            }
        });
    });
}

module.exports = {
    sendTCPMessage
};