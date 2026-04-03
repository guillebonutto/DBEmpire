import React, { useState, useMemo, useRef } from 'react';
import { View, Text, PanResponder } from 'react-native';
import Svg, { Path, Line, G, Defs, Rect, ClipPath, Text as SvgText, Circle } from 'react-native-svg';

const CustomProgressChart = ({ progressData }) => {
    const [containerWidth, setContainerWidth] = useState(0);
    const [tooltip, setTooltip] = useState(null); // { x, y, value, label, index }

    // Keep a ref to allPoints so PanResponder can access latest without re-creating
    const allPointsRef = useRef([]);
    const innerGeomRef = useRef({ paddingLeft: 62, paddingRight: 16, paddingTop: 20, paddingBottom: 38, innerWidth: 0 });

    const { chartContent } = useMemo(() => {
        if (!progressData?.datasets || progressData.datasets.length === 0) return { chartContent: null };
        if (containerWidth === 0) return { chartContent: null };

        const data = progressData.datasets[0].data;
        if (data.length === 0) return { chartContent: null };

        const chartWidth = containerWidth;
        const chartHeight = 220;
        const paddingLeft = 62;
        const paddingRight = 16;
        const paddingTop = 20;
        const paddingBottom = 38;

        const innerWidth = chartWidth - paddingLeft - paddingRight;
        const innerHeight = chartHeight - paddingTop - paddingBottom;

        // Always include 0 in the visible range
        const rawMin = Math.min(...data, 0);
        const rawMax = Math.max(...data, 0);
        const rawRange = rawMax - rawMin;
        const pad = rawRange === 0 ? 10 : rawRange * 0.06;
        const minY = rawMin - (rawMin < 0 ? pad : 0);
        const maxY = rawMax + (rawMax > 0 ? pad : 0);
        const dataRange = maxY - minY || 1;

        const getX = (index) => paddingLeft + (index / Math.max(data.length - 1, 1)) * innerWidth;
        const getY = (value) => {
            if (dataRange === 0) return paddingTop + innerHeight / 2;
            return paddingTop + innerHeight - ((value - minY) / dataRange) * innerHeight;
        };

        const zeroY = getY(0);

        const clipAboveId = `clipAbove_${Math.round(zeroY * 100)}_${containerWidth}`;
        const clipBelowId = `clipBelow_${Math.round(zeroY * 100)}_${containerWidth}`;

        const allPoints = data.map((v, i) => ({
            x: getX(i),
            y: getY(v),
            value: v,
            label: (progressData.labels?.[i] !== undefined && progressData.labels[i] !== null && progressData.labels[i] !== '') ? String(progressData.labels[i]) : `Punto ${i + 1}`,
            index: i,
        }));

        // Store in ref for PanResponder
        allPointsRef.current = allPoints;
        innerGeomRef.current = { paddingLeft, paddingRight, paddingTop, paddingBottom, innerWidth };

        const getBezierPath = (points) => {
            if (points.length === 0) return '';
            if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
            let path = `M ${points[0].x} ${points[0].y}`;
            for (let i = 0; i < points.length - 1; i++) {
                const xmid = (points[i].x + points[i + 1].x) / 2;
                path += ` C ${xmid} ${points[i].y} ${xmid} ${points[i + 1].y} ${points[i + 1].x} ${points[i + 1].y}`;
            }
            return path;
        };

        const linePath = getBezierPath(allPoints);
        const firstX = getX(0);
        const lastX = getX(data.length - 1);
        const areaPath = linePath + ` L ${lastX} ${zeroY} L ${firstX} ${zeroY} Z`;

        // Y-axis labels
        const yAxisLabels = [];
        for (let i = 0; i < 5; i++) {
            const value = minY + (i / 4) * dataRange;
            yAxisLabels.push({ value, y: getY(value) });
        }

        const formatY = (val) => {
            const abs = Math.abs(val);
            if (abs >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
            if (abs >= 1000) return `$${(val / 1000).toFixed(0)}k`;
            return `$${val.toFixed(0)}`;
        };

        // X-axis labels — max 8, always first and last
        const rawLabels = progressData.labels || [];
        const maxLabels = 8;
        const step = rawLabels.length > maxLabels ? Math.ceil(rawLabels.length / maxLabels) : 1;
        const xAxisLabels = rawLabels
            .map((label, index) => ({ label, x: getX(index), index }))
            .filter((_, i) => i % step === 0 || i === rawLabels.length - 1);

        const chartSvg = (
            <Svg width={chartWidth} height={chartHeight} pointerEvents="none">
                <Defs>
                    <ClipPath id={clipAboveId}>
                        <Rect x="0" y="0" width={chartWidth} height={zeroY} />
                    </ClipPath>
                    <ClipPath id={clipBelowId}>
                        <Rect x="0" y={zeroY} width={chartWidth} height={chartHeight - zeroY} />
                    </ClipPath>
                </Defs>

                {/* Grid lines Y */}
                {yAxisLabels.map((l, i) => (
                    <Line key={`gy-${i}`} x1={paddingLeft} y1={l.y} x2={chartWidth - paddingRight} y2={l.y} stroke="#1e1e1e" strokeWidth="0.8" />
                ))}

                {/* Grid lines X */}
                {xAxisLabels.map((l, i) => (
                    <Line key={`gx-${i}`} x1={l.x} y1={paddingTop} x2={l.x} y2={chartHeight - paddingBottom} stroke="#1a1a1a" strokeWidth="0.5" />
                ))}

                {/* GREEN area (above zero) */}
                <Path d={areaPath} fill="rgba(0, 255, 136, 0.35)" clipPath={`url(#${clipAboveId})`} />

                {/* RED area (below zero) */}
                <Path d={areaPath} fill="rgba(255, 77, 77, 0.35)" clipPath={`url(#${clipBelowId})`} />

                {/* Zero line */}
                <Line
                    x1={paddingLeft}
                    y1={zeroY}
                    x2={chartWidth - paddingRight}
                    y2={zeroY}
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="5, 4"
                />

                {/* Data line */}
                <Path d={linePath} stroke="rgba(180,180,180,0.7)" strokeWidth="1" fill="none" />

                {/* Tooltip dot highlight */}
                {tooltip && allPoints[tooltip.index] && (
                    <Circle
                        cx={allPoints[tooltip.index].x}
                        cy={allPoints[tooltip.index].y}
                        r="5"
                        fill={tooltip.value >= 0 ? '#00ff88' : '#ff4d4d'}
                        stroke="#fff"
                        strokeWidth="1.5"
                    />
                )}

                {/* Y-axis labels */}
                <G>
                    {yAxisLabels.map((l, i) => (
                        <SvgText key={`yl-${i}`} x={paddingLeft - 5} y={l.y + 4} fill="#666" fontSize="9" textAnchor="end">
                            {formatY(l.value)}
                        </SvgText>
                    ))}
                </G>

                {/* X-axis labels */}
                <G>
                    {xAxisLabels.map((l, i) => (
                        <SvgText
                            key={`xl-${i}`}
                            x={l.x}
                            y={chartHeight - paddingBottom + 14}
                            fill="rgba(160,160,160,1)"
                            fontSize="9"
                            textAnchor="middle"
                        >
                            {l.label}
                        </SvgText>
                    ))}
                </G>
            </Svg>
        );

        return { chartContent: chartSvg };
    }, [progressData, containerWidth, tooltip]);

    // Find nearest point to a given X coordinate
    const getNearestPoint = (touchX) => {
        const points = allPointsRef.current;
        if (!points || points.length === 0) return null;
        let nearest = null;
        let minDist = Infinity;
        for (const pt of points) {
            const dist = Math.abs(pt.x - touchX);
            if (dist < minDist) {
                minDist = dist;
                nearest = pt;
            }
        }
        return nearest;
    };

    // PanResponder: handles tap, drag, and release
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,

            onPanResponderGrant: (evt) => {
                const touchX = evt.nativeEvent.locationX;
                const pt = getNearestPoint(touchX);
                if (pt) setTooltip(pt);
            },

            onPanResponderMove: (evt) => {
                const touchX = evt.nativeEvent.locationX;
                const pt = getNearestPoint(touchX);
                if (pt) setTooltip(pt);
            },

            onPanResponderRelease: (evt) => {
                // If finger released outside the chart area, dismiss tooltip
                const { paddingLeft, paddingRight, innerWidth } = innerGeomRef.current;
                const touchX = evt.nativeEvent.locationX;
                const touchY = evt.nativeEvent.locationY;
                const chartHeight = 220;
                const paddingTop = 20;
                const paddingBottom = 38;
                const isInsideX = touchX >= paddingLeft && touchX <= paddingLeft + innerWidth;
                const isInsideY = touchY >= paddingTop && touchY <= chartHeight - paddingBottom;
                if (!isInsideX || !isInsideY) {
                    setTooltip(null);
                }
            },

            onPanResponderTerminate: () => {
                setTooltip(null);
            },
        })
    ).current;

    const formatTooltipValue = (val) => {
        if (val === undefined || val === null) return '';
        const abs = Math.abs(val);
        if (abs >= 1000000) return `$${(val / 1000000).toFixed(2)}M`;
        if (abs >= 1000) return `$${val.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
        return `$${val.toFixed(2)}`;
    };

    return (
        <View>
            <View
                style={{
                    marginHorizontal: 4,
                    height: 220,
                    backgroundColor: '#0a0a0a',
                    borderRadius: 16,
                    overflow: 'visible',
                    borderWidth: 1,
                    borderColor: '#1a1a1a',
                    position: 'relative',
                }}
                onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
                {...panResponder.panHandlers}
            >
                {chartContent}

                {/* Floating tooltip */}
                {tooltip && (
                    <View
                        style={{
                            position: 'absolute',
                            left: Math.min(
                                Math.max(tooltip.x - 40, 4),
                                (containerWidth || 300) - 90
                            ),
                            top: Math.max(tooltip.y - 52, 4),
                            backgroundColor: '#1a1a1a',
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderWidth: 1,
                            borderColor: tooltip.value >= 0 ? '#00ff88' : '#ff4d4d',
                            zIndex: 100,
                            minWidth: 80,
                            alignItems: 'center',
                        }}
                        pointerEvents="none"
                    >
                        {tooltip.label ? (
                            <Text style={{ color: '#888', fontSize: 9, marginBottom: 2, fontWeight: '600' }}>
                                {tooltip.label}
                            </Text>
                        ) : null}
                        <Text style={{
                            color: tooltip.value >= 0 ? '#00ff88' : '#ff4d4d',
                            fontWeight: 'bold',
                            fontSize: 11,
                        }}>
                            {formatTooltipValue(tooltip.value)}
                        </Text>
                    </View>
                )}
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 10, height: 10, backgroundColor: '#00ff88', borderRadius: 2 }} />
                    <Text style={{ color: '#aaa', fontSize: 10, fontWeight: 'bold' }}>GANANCIA</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 10, height: 10, backgroundColor: '#ff4d4d', borderRadius: 2 }} />
                    <Text style={{ color: '#aaa', fontSize: 10, fontWeight: 'bold' }}>PÉRDIDA</Text>
                </View>
            </View>
        </View>
    );
};

export default CustomProgressChart;
