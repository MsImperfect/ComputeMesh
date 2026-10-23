const net = require("net");

function startTCPServer(
    peerId,
    port,
    messageHandler,
    onListening = null
) {
    const server = net.createServer((socket) => {

        const remoteAddress =
            socket.remoteAddress;

        const remotePort =
            socket.remotePort;

        console.log(
            `[TCP] Connection from ` +
            `${remoteAddress}:${remotePort}`
        );

        let buffer = "";

        socket.on("data", async (data) => {

            buffer += data.toString();

            const messages =
                buffer.split("\n");

            // Keep incomplete message
            buffer = messages.pop();

            for (const rawMessage of messages) {

                if (!rawMessage.trim()) {
                    continue;
                }

                console.log(
                    `[TCP] Received: ${rawMessage}`
                );

                try {

                    const message =
                        JSON.parse(rawMessage);

                    await messageHandler(
                        message,
                        socket
                    );

                } catch (error) {

                    console.log(
                        `[TCP] Invalid message: ` +
                        `${error.message}`
                    );

                    const errorResponse = {
                        type: "ERROR",
                        message:
                            "Invalid JSON message"
                    };

                    socket.write(
                        JSON.stringify(
                            errorResponse
                        ) + "\n"
                    );
                }
            }
        });

        socket.on("close", () => {
            console.log(
                `[TCP] Connection closed: ` +
                `${remoteAddress}:${remotePort}`
            );
        });

        socket.on("error", (error) => {
            console.log(
                `[TCP] Socket error: ` +
                `${error.message}`
            );
        });
    });

    server.once("error", (error) => {
        if (error.code === "EADDRINUSE") {
            console.warn(
                `[TCP] Port ${port} is in use, retrying on port ${port + 1}...`
            );
            startTCPServer(peerId, port + 1, messageHandler, onListening);
        } else {
            console.error(
                `[TCP] Server error: ` +
                `${error.message}`
            );
        }
    });

    server.listen(
        port,
        "0.0.0.0",
        () => {
            console.log(
                `[TCP] ${peerId} listening ` +
                `on port ${port}`
            );
            if (typeof onListening === "function") {
                onListening(port);
            }
        }
    );

    return server;
}

module.exports = {
    startTCPServer
};