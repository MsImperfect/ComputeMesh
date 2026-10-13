const net = require("net");

function startTCPServer(
    peerId,
    port,
    messageHandler
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

        socket.on("data", (data) => {

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

                    messageHandler(
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

    server.listen(
        port,
        "0.0.0.0",
        () => {
            console.log(
                `[TCP] ${peerId} listening ` +
                `on port ${port}`
            );
        }
    );

    server.on("error", (error) => {
        console.error(
            `[TCP] Server error: ` +
            `${error.message}`
        );
    });

    return server;
}

module.exports = {
    startTCPServer
};