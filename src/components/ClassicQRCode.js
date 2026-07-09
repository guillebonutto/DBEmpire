import React from 'react';
import { View, Image } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

const ClassicQRCode = ({ 
    value, 
    size = 280, 
    color = '#000000', 
    backgroundColor = '#ffffff',
    logoSrc
}) => {
    // Generar la matriz del QR con corrección de errores nivel H (Alto) para soportar el logo en el centro
    const qr = qrcode(0, 'H');
    qr.addData(value);
    qr.make();
    
    const count = qr.getModuleCount();
    const cellSize = size / count;

    // Calcular la zona central para limpiar los módulos y hacer espacio para el logo
    const clearSizePercent = 0.26; // El 26% central del QR quedará libre para el logo
    const centerStart = Math.floor(count * (0.5 - clearSizePercent / 2));
    const centerEnd = Math.ceil(count * (0.5 + clearSizePercent / 2));

    const squares = [];
    for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
            // Si está dentro de la zona central a limpiar y hay un logo configurado, omitimos dibujar el módulo
            if (logoSrc && row >= centerStart && row < centerEnd && col >= centerStart && col < centerEnd) {
                continue;
            }

            if (qr.isDark(row, col)) {
                squares.push(
                    <Rect
                        key={`${row}-${col}`}
                        x={col * cellSize}
                        y={row * cellSize}
                        width={cellSize + 0.25} // Offset sutil para evitar líneas fantasmas entre bloques
                        height={cellSize + 0.25}
                        fill={color}
                    />
                );
            }
        }
    }

    const innerSvgSize = size - 24; // Padding para el borde
    const logoSize = size * 0.22; // Tamaño del logo en el centro (22% del QR)

    return (
        <View style={{ width: size, height: size, backgroundColor: backgroundColor, padding: 12, borderRadius: 20, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
            <Svg width={innerSvgSize} height={innerSvgSize} viewBox={`0 0 ${size} ${size}`}>
                {squares}
            </Svg>
            
            {/* Logo en el centro exacto posicionado absolutamente */}
            {logoSrc && (
                <View style={{
                    position: 'absolute',
                    width: logoSize,
                    height: logoSize,
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <Image 
                        source={typeof logoSrc === 'string' ? { uri: logoSrc } : logoSrc}
                        style={{
                            width: '100%',
                            height: '100%',
                            resizeMode: 'contain'
                        }}
                    />
                </View>
            )}
        </View>
    );
};

export default ClassicQRCode;
