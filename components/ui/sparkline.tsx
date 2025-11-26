import React from 'react';
import { cn } from "@/lib/utils";

interface SparklineProps {
    data?: string | number[];
    width?: number;
    height?: number;
    className?: string;
}

export function Sparkline({ data, width = 100, height = 30, className }: SparklineProps) {
    if (!data) return null;

    let points: number[] = [];

    if (Array.isArray(data)) {
        points = data;
    } else if (typeof data === 'string') {
        points = data.split(',').map(Number).filter(n => !isNaN(n));
    }

    if (points.length < 2) return null;

    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min;

    // Avoid division by zero if all points are the same
    const safeRange = range === 0 ? 1 : range;

    const polylinePoints = points.map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        // Invert Y axis because SVG coordinates start from top
        const y = height - ((p - min) / safeRange) * height;
        return `${x},${y}`;
    }).join(' ');

    const isUptrend = points[points.length - 1] >= points[0];
    const colorClass = isUptrend ? "text-emerald-500" : "text-rose-500";

    return (
        <svg width={width} height={height} className={cn("overflow-visible", className)}>
            <polyline
                points={polylinePoints}
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={colorClass}
            />
        </svg>
    );
}
