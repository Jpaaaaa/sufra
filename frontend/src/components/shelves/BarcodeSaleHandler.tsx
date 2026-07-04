import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import i18n from '../../i18n';
import { useBarcodeListener } from '../../contexts/BarcodeListenerContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchJson, getServerUrl } from '../../utils';
import { ShelfItem } from '../../hooks/useShelves';
import { showGlobalShelfSaleModal, showGlobalShelfAddModal } from './GlobalShelfSaleModal';
import { showToast } from '../ui/Toast';

export function BarcodeSaleHandler() {
  const { setBarcodeHandler } = useBarcodeListener();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const handleBarcode = async (barcode: string) => {
      if (!barcode || barcode.trim().length === 0) {
        return;
      }

      const trimmedBarcode = barcode.trim();

      try {
        const serverUrl = getServerUrl();
        // Check if barcode exists in shelf_items
        const item = await fetchJson<ShelfItem>(`${serverUrl}/shelves/barcode/${encodeURIComponent(trimmedBarcode)}`);
        
        // If item exists and is valid, show the sale modal
        if (item && item.id && item.barcode) {
          await showGlobalShelfSaleModal(item);
        } else {
          // Item doesn't exist (null/undefined response), show add modal
          await showGlobalShelfAddModal(trimmedBarcode);
        }
      } catch (error: any) {
        // Check if it's a 404 or not found error
        const errorMessage = error.message || '';
        const errorMessageLower = errorMessage.toLowerCase();
        const statusCode = error.statusCode || error.status || error.code;
        
        // Detect 404/not found errors in various formats
        const isNotFound = 
          statusCode === 404 ||
          statusCode === '404' ||
          errorMessage.includes('404') || 
          errorMessage.includes('status 404') ||
          errorMessage.includes('Not Found') ||
          errorMessage.includes('not found') ||
          errorMessage.includes('Shelf item not found') ||
          errorMessageLower.includes('404') ||
          errorMessageLower.includes('not found') ||
          errorMessageLower.includes('shelf item not found') ||
          errorMessageLower.includes('notfoundexception');
        
        if (isNotFound) {
          // Open the global shelf modal in add mode with the scanned barcode
          await showGlobalShelfAddModal(trimmedBarcode);
          return;
        }
        // For other errors, show a user-friendly message
        showToast(i18n.t('shelves.toastBarcodeLookupError'), 'error');
      }
    };

    setBarcodeHandler(handleBarcode);

    return () => {
      setBarcodeHandler(null);
    };
  }, [isAuthenticated, setBarcodeHandler, pathname]);

  return null; // This component doesn't render anything
}

