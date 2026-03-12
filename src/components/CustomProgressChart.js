import React, { useState, useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Line, G, Defs, Rect, ClipPath, Text as SvgText } from 'react-native-svg';

const CustomProgressChart = ({ progressData }) => {
    const [containerWidth, setContainerWidth] = useState(0);

    const chartContent = useMemo(() => {
        if (!progressData?.datasets || progressData.datasets.length === 0) return null;
        if (containerWidth === 0) return null;

        const data = progressData.datasets[0].data;
        if (data.length === 0) return null;

        const chartWidth = containerWidth;
        const chartHeight = 220;
        const paddingLeft = 55;   // space for Y labels
        const paddingRight = 20;
        const paddingTop = 20;
        const paddingBottom = 35; // space for X labels

        const innerWidth = chartWidth - paddingLeft - paddingRight;
        const innerHeight = chartHeight - paddingTop - paddingBottom;

        const minY = Math.min(...data, -100);
        const maxY = Math.max(...data, 100);
        const dataRange = maxY - minY;

        const getX = (index) => paddingLeft + (index / Math.max(data.length - 1, 1)) * innerWidth;
        const getY = (value) => {
            if (dataRange === 0) return paddingTop + innerHeight / 2;
            return paddingTop + innerHeight - ((value - minY) / dataRange) * innerHeight;
        };

        const zeroY = getY(0);

        // Dynamic ClipPath IDs to force re-render on data change
        const clipAboveId = `clipAbove_${Math.round(zeroY * 100)}_${containerWidth}`;
        const clipBelowId = `clipBelow_${Math.round(zeroY * 100)}_${containerWidth}`;

        // Smooth bezier path
        const allPoints = data.map((v, i) => ({ x: getX(i), y: getY(v) }));
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
            yAxisLabels.push({ value: value.toFixed(0), y: getY(value) });
        }

        // X-axis labels — max 7 to avoid overlap
        const rawLabels = progressData.labels || [];
        const step = rawLabels.length > 7 ? Math.ceil(rawLabels.length / 7) : 1;
        const xAxisLabels = rawLabels
            .map((label, index) => ({ label, x: getX(index) }))
            .filter((_, i) => i % step === 0 || i === rawLabels.length - 1);

        return (
            <Svg width={chartWidth} height={chartHeight}>
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

                {/* GREEN area */}
                <Path d={areaPath} fill="rgba(0, 255, 136, 0.35)" clipPath={`url(#${clipAboveId})`} />

                {/* RED area */}
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

                {/* Y-axis labels */}
                <G>
                    {yAxisLabels.map((l, i) => (
                        <SvgText key={`yl-${i}`} x={paddingLeft - 5} y={l.y + 4} fill="#666" fontSize="9" textAnchor="end">
                            {`$${Number(l.value).toLocaleString('es-AR')}`}
                        </SvgText>
                    ))}
                </G>

                {/* X-axis labels */}
                <G>
                    {xAxisLabels.map((l, i) => (
                        <SvgText key={`xl-${i}`} x={l.x} y={chartHeight - paddingBottom + 14} fill="rgba(160,160,160,1)" fontSize="9" textAnchor="middle">
                            {l.label}
                        </SvgText>
                    ))}
                </G>
            </Svg>
        );
    }, [progressData, containerWidth]);

    return (
        <View>
            <View
                style={{
                    marginHorizontal: 4,
                    height: 220,
                    backgroundColor: '#0a0a0a',
                    borderRadius: 16,
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: '#1a1a1a',
                }}
                onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
            >
                {chartContent}

                {/* Info about days if labels exist */}
                {progressData.labels?.length > 0 && (
                    <View style={{ position: 'absolute', bottom: 6, left: 0, right: 0, alignItems: 'center' }}>
                        <Text style={{ color: '#444', fontSize: 8, fontWeight: 'bold', letterSpacing: 1 }}>DÍAS DEL PERÍODO</Text>
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
