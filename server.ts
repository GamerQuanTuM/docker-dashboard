import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import Docker from "dockerode";
import { PassThrough } from "node:stream";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

const docker = new Docker();

app.prepare().then(() => {
    const httpServer = createServer(handler);

    const io = new Server(httpServer);

    io.on("connection", (socket) => {
        console.log("Client connected");

        socket.on("list-containers", async () => {
            try {
                const containers = await docker.listContainers();
                socket.emit("containers-list", containers);
            } catch (error) {
                console.error("Error listing containers:", error);
                socket.emit("error", "Failed to list containers");
            }
        });

        socket.on("subscribe-logs", async (containerId, timeRange = "5m") => {
            console.log(`Subscribing to logs for container: ${containerId} with range: ${timeRange}`);
            try {
                const container = docker.getContainer(containerId);

                // Calculate since timestamp
                let since = 0;
                const now = Math.floor(Date.now() / 1000);

                const match = timeRange.match(/^(\d+)([smhdw])$/);
                if (match) {
                    const value = parseInt(match[1]);
                    const unit = match[2];
                    let seconds = 0;
                    switch (unit) {
                        case 's': seconds = value; break;
                        case 'm': seconds = value * 60; break;
                        case 'h': seconds = value * 3600; break;
                        case 'd': seconds = value * 86400; break;
                        case 'w': seconds = value * 604800; break;
                    }
                    since = now - seconds;
                }

                // Get logs stream
                const stream = await container.logs({
                    follow: true,
                    stdout: true,
                    stderr: true,
                    since: since,
                });

                console.log("Stream established for", containerId);

                // Create streams for stdout and stderr
                const stdout = new PassThrough();
                const stderr = new PassThrough();

                // Demultiplex the stream
                container.modem.demuxStream(stream, stdout, stderr);

                const handleData = (chunk: Buffer) => {
                    socket.emit("log-chunk", chunk.toString('utf8'));
                };

                stdout.on("data", handleData);
                stderr.on("data", handleData);

                stream.on("end", () => {
                    console.log(`Stream ended for ${containerId}`);
                });

                stream.on("error", (err) => {
                    console.error(`Stream error for ${containerId}:`, err);
                });

                socket.on("disconnect", () => {
                    console.log("Client disconnected, destroying stream");
                    (stream as any).destroy();
                    stdout.destroy();
                    stderr.destroy();
                });

                // Also listen for a specific unsubscribe event if user switches containers
                socket.on("unsubscribe-logs", () => {
                    console.log("Unsubscribing logs");
                    (stream as any).destroy();
                    stdout.destroy();
                    stderr.destroy();
                });

            } catch (error) {
                console.error(`Error getting logs for ${containerId}:`, error);
                socket.emit("error", `Failed to get logs for ${containerId}`);
            }
        });
    });

    httpServer
        .once("error", (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
