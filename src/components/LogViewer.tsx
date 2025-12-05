"use client";

import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

interface LogViewerProps {
    socket: Socket | null;
    containerId: string | null;
}

function TerminalView({ socket, containerId, timeRange }: { socket: Socket | null, containerId: string, timeRange: string }) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        console.log("Initializing Xterm");
        // Initialize xterm
        const term = new Terminal({
            cursorBlink: true,
            convertEol: true, // Fixes staircase effect
            theme: {
                background: "#000000", // Pure black for better contrast
                foreground: "#f8f8f2", // Off-white
                cursor: "#f8f8f2",
                selectionBackground: "#44475a",
            },
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: 14,
            lineHeight: 1.2,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        const handleResize = () => {
            fitAddon.fit();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            term.dispose();
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    useEffect(() => {
        console.log("TerminalView useEffect triggered", { socket: !!socket, containerId, xterm: !!xtermRef.current, timeRange });
        if (!socket || !containerId || !xtermRef.current) return;

        const term = xtermRef.current;

        // Clear terminal when switching containers or time range
        term.clear();
        term.writeln(`Connecting to logs for container ${containerId} (Last ${timeRange})...`);

        // Subscribe to logs
        console.log("Emitting subscribe-logs for", containerId, timeRange);
        socket.emit("subscribe-logs", containerId, timeRange);

        let hasReceivedLogs = false;
        const timeoutId = setTimeout(() => {
            if (!hasReceivedLogs) {
                term.writeln("\r\nNo logs available for this time range.");
            }
        }, 2000);

        const handleLogChunk = (chunk: string) => {
            if (!hasReceivedLogs) {
                hasReceivedLogs = true;
                clearTimeout(timeoutId);
                // Optional: Clear the "Connecting..." message if you want a clean start
                // term.clear(); 
            }
            term.write(chunk);
        };

        socket.on("log-chunk", handleLogChunk);

        return () => {
            console.log("Unsubscribing logs for", containerId);
            clearTimeout(timeoutId);
            socket.emit("unsubscribe-logs");
            socket.off("log-chunk", handleLogChunk);
        };
    }, [socket, containerId, timeRange]);

    // Refit on container change or visibility change
    useEffect(() => {
        if (fitAddonRef.current) {
            setTimeout(() => {
                fitAddonRef.current?.fit();
            }, 100);
        }
    }, [containerId]);

    return (
        <div className="flex-1 bg-slate-950 p-4 overflow-hidden flex flex-col">
            <div className="flex-1 relative">
                <div ref={terminalRef} className="absolute inset-0" />
            </div>
        </div>
    );
}

export default function LogViewer({ socket, containerId }: LogViewerProps) {
    const [timeRange, setTimeRange] = useState("5m");

    if (!containerId) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-950 text-gray-500">
                Select a container to view logs
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
            <div className="h-10 bg-gray-900 border-b border-gray-800 flex items-center px-4 justify-end">
                <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="bg-gray-800 text-white text-sm border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                >
                    <option value="5s">Last 5s</option>
                    <option value="10s">Last 10s</option>
                    <option value="30s">Last 30s</option>
                    <option value="1m">Last 1m</option>
                    <option value="5m">Last 5m</option>
                    <option value="30m">Last 30m</option>
                    <option value="1h">Last 1h</option>
                    <option value="3h">Last 3h</option>
                    <option value="12h">Last 12h</option>
                    <option value="1d">Last 1d</option>
                    <option value="7d">Last 7d</option>
                </select>
            </div>
            <TerminalView socket={socket} containerId={containerId} timeRange={timeRange} />
        </div>
    );
}
