"use client";

import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

interface Container {
    Id: string;
    Names: string[];
    Image: string;
    State: string;
    Status: string;
}

interface ContainerListProps {
    socket: Socket | null;
    onSelectContainer: (containerId: string) => void;
    selectedContainerId: string | null;
    isOpen: boolean;
}

export default function ContainerList({
    socket,
    onSelectContainer,
    selectedContainerId,
    isOpen,
}: ContainerListProps) {
    const [containers, setContainers] = useState<Container[]>([]);

    useEffect(() => {
        if (!socket) return;

        // Request initial list
        socket.emit("list-containers");

        // Listen for updates
        socket.on("containers-list", (data: Container[]) => {
            setContainers(data);
        });

        // Optional: Poll for updates every few seconds
        const interval = setInterval(() => {
            socket.emit("list-containers");
        }, 5000);

        return () => {
            socket.off("containers-list");
            clearInterval(interval);
        };
    }, [socket]);

    return (
        <div
            className={`bg-gray-900 border-r border-gray-800 flex flex-col h-full transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? "w-64 opacity-100" : "w-0 opacity-0 border-r-0"
                }`}
        >
            <div className="p-4 border-b border-gray-800 shrink-0">
                <h2 className="text-lg font-semibold text-white whitespace-nowrap">Containers</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
                {containers.map((container) => (
                    <button
                        key={container.Id}
                        onClick={() => onSelectContainer(container.Id)}
                        className={`w-full text-left p-3 hover:bg-gray-800 transition-colors border-b border-gray-800/50 ${selectedContainerId === container.Id ? "bg-gray-800 border-l-4 border-l-blue-500" : ""
                            }`}
                    >
                        <div className="font-medium text-gray-200 truncate">
                            {container.Names[0].replace("/", "")}
                        </div>
                        <div className="text-xs text-gray-500 truncate mt-1">
                            {container.Image}
                        </div>
                        <div className="flex items-center mt-2">
                            <span
                                className={`w-2 h-2 rounded-full mr-2 ${container.State === "running" ? "bg-green-500" : "bg-red-500"
                                    }`}
                            />
                            <span className="text-xs text-gray-400 capitalize">
                                {container.State}
                            </span>
                        </div>
                    </button>
                ))}
                {containers.length === 0 && (
                    <div className="p-4 text-gray-500 text-sm text-center whitespace-nowrap">No containers found</div>
                )}
            </div>
        </div>
    );
}
