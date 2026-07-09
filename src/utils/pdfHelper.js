import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Safely prints or shares an HTML content as a PDF.
 * If Sharing is not available (e.g., on web or in dev client without sharing modules),
 * it falls back to showing the print dialog of the device.
 * 
 * @param {string} htmlContent - The HTML string to generate PDF from.
 * @param {object} options - Sharing/Printing options.
 * @param {string} options.dialogTitle - The title for the share/print dialog.
 * @param {string} options.mimeType - The mimeType for sharing (defaults to 'application/pdf').
 * @param {string} options.UTI - Uniform Type Identifier for iOS sharing (defaults to '.pdf').
 */
export const printOrSharePDF = async (htmlContent, options = {}) => {
    const dialogTitle = options.dialogTitle || 'Exportar PDF';
    const mimeType = options.mimeType || 'application/pdf';
    const UTI = options.UTI || '.pdf';

    try {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (Platform.OS === 'web' || !isSharingAvailable) {
            // Falls back to standard print dialog which allows "Save as PDF"
            await Print.printAsync({ html: htmlContent });
        } else {
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { mimeType, UTI, dialogTitle });
        }
    } catch (error) {
        console.error('PDF Generation Error:', error);
        throw error;
    }
};
