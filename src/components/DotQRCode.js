import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

const DotQRCode = ({ 
    value, 
    size = 280, 
    dotColor = '#d4af37', 
    centerSize = 0.35, // Porcentaje del centro para dejar vacío (0.35 = 35%)
    dotScale = 0.45    // Tamaño de los puntos (0.45 = efecto halftone fino)
}) => {
    
    // Generar la matriz del QR
    const qr = qrcode(0, 'H');
    qr.addData(value);
    qr.make();
    
    const count = qr.getModuleCount();
    const cellSize = size / count;
    const centerStart = Math.floor(count * (1 - centerSize) / 2);
    const centerEnd = count - centerStart;

    const isInCenter = (row, col) => {
        return row >= centerStart && row < centerEnd && col >= centerStart && col < centerEnd;
    };

    const isEye = (row, col) => {
        // Marcadores de posición estándar (7x7 en las esquinas)
        if (row < 7 && col < 7) return true; // Top Left
        if (row < 7 && col >= count - 7) return true; // Top Right
        if (row >= count - 7 && col < 7) return true; // Bottom Left
        return false;
    };

    const dots = [];
    for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) {
                // Si está en el centro o es un ojo, no dibujamos el punto base
                if (isInCenter(row, col) || isEye(row, col)) continue;

                dots.push(
                    <Circle
                        key={`${row}-${col}`}
                        cx={col * cellSize + cellSize / 2}
                        cy={row * cellSize + cellSize / 2}
                        r={(cellSize / 2) * dotScale}
                        fill={dotColor}
                    />
                );
            }
        }
    }

    // Dibujamos los "Ojos Imperiales" por separado (Estilo Anillos Dorados)
    const renderEye = (x, y) => {
        const eyeSize = 7 * cellSize;
        const outerR = eyeSize / 2;
        const innerR = eyeSize / 4;
        const center = eyeSize / 2;

        return (
            <G x={x} y={y}>
                {/* Anillo Exterior */}
                <Circle cx={center} cy={center} r={outerR - 2} stroke={dotColor} strokeWidth={cellSize * 1.5} fill="white" />
                {/* Punto Central */}
                <Circle cx={center} cy={center} r={innerR} fill={dotColor} />
            </G>
        );
    };

    return (
        <View style={{ width: size, height: size, backgroundColor: 'transparent', overflow: 'hidden' }}>
            <Svg width={size} height={size}>
                {/* Dibujar todos los puntos de datos */}
                {dots}

                {/* Dibujar los 3 ojos posicionales */}
                {renderEye(0, 0)}
                {renderEye((count - 7) * cellSize, 0)}
                {renderEye(0, (count - 7) * cellSize)}
            </Svg>
        </View>
    );
};

export default DotQRCode;
