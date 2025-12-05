"use client";

import { useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

interface LogViewerProps {
    socket: Socket | null;
    containerId: string | null;
}

function TerminalView({ socket, containerId }: { socket: Socket | null, containerId: string }) {
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
        console.log("TerminalView useEffect triggered", { socket: !!socket, containerId, xterm: !!xtermRef.current });
        if (!socket || !containerId || !xtermRef.current) return;

        const term = xtermRef.current;

        // Clear terminal when switching containers
        term.clear();
        term.writeln(`Connecting to logs for container ${containerId}...`);

        // Subscribe to logs
        console.log("Emitting subscribe-logs for", containerId);
        socket.emit("subscribe-logs", containerId);

        const handleLogChunk = (chunk: string) => {
            // console.log("Received log chunk", chunk.length);
            term.write(chunk);
        };

        socket.on("log-chunk", handleLogChunk);

        return () => {
            console.log("Unsubscribing logs for", containerId);
            socket.emit("unsubscribe-logs");
            socket.off("log-chunk", handleLogChunk);
        };
    }, [socket, containerId]);

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
    if (!containerId) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-950 text-gray-500">
                Select a container to view logs
            </div>
        );
    }

    return <TerminalView socket={socket} containerId={containerId} />;
}
