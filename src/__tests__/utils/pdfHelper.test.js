import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { printOrSharePDF } from '../../utils/pdfHelper';

jest.mock('expo-print', () => ({
  printAsync: jest.fn(),
  printToFileAsync: jest.fn().mockResolvedValue({ uri: 'file://test.pdf' }),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

describe('pdfHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should print instead of share if sharing is unavailable', async () => {
    Sharing.isAvailableAsync.mockResolvedValue(false);
    
    await printOrSharePDF('<p>Hello</p>', { dialogTitle: 'Test' });

    expect(Print.printAsync).toHaveBeenCalledWith({ html: '<p>Hello</p>' });
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('should print to file and share if sharing is available', async () => {
    Sharing.isAvailableAsync.mockResolvedValue(true);
    Platform.OS = 'ios'; // Ensure it's not web
    
    await printOrSharePDF('<p>Hello</p>', { dialogTitle: 'Test Title' });

    expect(Print.printToFileAsync).toHaveBeenCalledWith({ html: '<p>Hello</p>' });
    expect(Sharing.shareAsync).toHaveBeenCalledWith('file://test.pdf', {
      dialogTitle: 'Test Title',
      mimeType: 'application/pdf',
      UTI: '.pdf'
    });
  });

  it('should print instead of share on web platform', async () => {
    Sharing.isAvailableAsync.mockResolvedValue(true); // even if available, web doesn't support sharing local files usually
    Platform.OS = 'web';
    
    await printOrSharePDF('<h1>Web test</h1>');

    expect(Print.printAsync).toHaveBeenCalledWith({ html: '<h1>Web test</h1>' });
  });

  it('should re-throw errors', async () => {
    Sharing.isAvailableAsync.mockRejectedValue(new Error('Sharing error'));
    
    await expect(printOrSharePDF('<p>Fail</p>')).rejects.toThrow('Sharing error');
  });
});
