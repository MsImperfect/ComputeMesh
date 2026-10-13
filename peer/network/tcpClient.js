const net = require("net");

function sendTCPMessage(host, port, message) {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();

        let buffer = "";

        socket.setTimeout(5000);

        socket.connect(port, host, () => {
            console.log(
                `[TCP] Connected to ${host}:${port}`
            );

            const data = JSON.stringify(message) + "\n";

            console.log(
                `[TCP] Sending: ${data.trim()}`
            );

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

                console.log(
                    `[TCP] Response: ${rawMessage}`
                );

                try {
                    const response = JSON.parse(rawMessage);

                    resolve(response);

                    socket.end();
                } catch (error) {
                    reject(
                        new Error(
                            `Invalid TCP response: ${error.message}`
                        )
                    );
                }
            }
        });

        socket.on("timeout", () => {
            socket.destroy();

            reject(
                new Error(
                    "TCP connection timed out after 5 seconds"
                )
            );
        });

        socket.on("error", (error) => {
            reject(error);
        });

        socket.on("close", () => {
            console.log("[TCP] Connection closed");
        });
    });
}

module.exports = {
    sendTCPMessage
};