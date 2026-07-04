/** Inline styles for DeliveryOrderModal (tablet breakpoints + scrollbars). */
export const DELIVERY_ORDER_MODAL_EMBEDDED_CSS = `
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        [data-scrollable]::-webkit-scrollbar {
          width: 8px;
        }
        [data-scrollable]::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 4px;
        }
        [data-scrollable]::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }
        [data-scrollable]::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.3);
        }
        /* Tablet PORTRAIT: vertical - menu on top, cart below */
        @media (min-width: 768px) and (max-width: 1279px) and (max-aspect-ratio: 1/1) {
          [data-order-modal] {
            height: 85svh !important;
            max-height: 85svh !important;
          }
          [data-order-modal-body] {
            flex-direction: column !important;
            gap: 0 !important;
          }
          [data-order-modal] [data-order-menu] {
            width: 100% !important;
            min-width: unset !important;
            max-width: unset !important;
            flex: 0 0 auto !important;
            max-height: 45% !important;
            border-left: none !important;
            border-bottom: 1px solid rgba(0,0,0,0.05) !important;
            padding: 8px !important;
          }
          [data-order-modal] [data-order-cart] {
            width: 100% !important;
            min-width: unset !important;
            max-width: unset !important;
            flex: 1 1 auto !important;
            border-left: none !important;
            border-top: 1px solid rgba(0,0,0,0.05) !important;
            padding: 8px !important;
          }
          [data-order-modal] [data-order-item-grid] {
            grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)) !important;
            gap: 6px !important;
          }
          [data-order-modal] [data-order-menu-filters] {
            flex-direction: row !important;
            align-items: center !important;
            gap: 8px !important;
          }
          [data-order-modal] [data-order-menu-filters] > div:first-child {
            flex: 1 !important;
            min-width: 0 !important;
          }
          [data-order-modal] [data-order-menu-filters] > div:last-child {
            width: 140px !important;
            flex-shrink: 0 !important;
          }
        }
        /* Tablet LANDSCAPE: horizontal - menu left, cart right */
        @media (min-width: 768px) and (max-width: 1279px) and (min-aspect-ratio: 1/1) {
          [data-order-modal] {
            height: 85svh !important;
            max-height: 85svh !important;
          }
          [data-order-modal-body] {
            flex-direction: row !important;
            gap: 0.5rem !important;
          }
          [data-order-modal] [data-order-menu] {
            width: auto !important;
            min-width: unset !important;
            max-width: unset !important;
            max-height: none !important;
            flex: 1 1 auto !important;
            border-left: 1px solid rgba(0,0,0,0.05) !important;
            border-bottom: none !important;
            padding: 6px !important;
          }
          [data-order-modal] [data-order-cart] {
            width: 28% !important;
            min-width: 180px !important;
            max-width: 280px !important;
            flex: 0 0 auto !important;
            border-left: 1px solid rgba(0,0,0,0.05) !important;
            border-top: none !important;
            padding: 6px !important;
          }
          [data-order-modal] [data-order-menu-filters] {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          [data-order-modal] [data-order-menu-filters] > div:first-child,
          [data-order-modal] [data-order-menu-filters] > div:last-child {
            flex: none !important;
            min-width: unset !important;
            width: auto !important;
          }
          [data-order-modal] [data-order-item-grid] {
            grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)) !important;
            gap: 4px !important;
          }
        }
        /* Desktop: horizontal layout (1280px+) */
        @media (min-width: 1280px) {
          [data-order-modal-body] {
            flex-direction: row !important;
            gap: 1rem !important;
          }
          [data-order-modal] [data-order-menu] {
            width: auto !important;
            min-width: unset !important;
            max-width: unset !important;
            max-height: none !important;
            flex: 1 1 auto !important;
            border-left: 1px solid rgba(0,0,0,0.05) !important;
            border-bottom: none !important;
            padding: 1rem !important;
          }
          [data-order-modal] [data-order-cart] {
            width: 30% !important;
            min-width: 260px !important;
            max-width: 360px !important;
            flex: 0 0 auto !important;
            border-left: 1px solid rgba(0,0,0,0.05) !important;
            border-top: none !important;
            padding: 0.625rem 1rem !important;
          }
          [data-order-modal] [data-order-menu-filters] {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          [data-order-modal] [data-order-menu-filters] > div:first-child,
          [data-order-modal] [data-order-menu-filters] > div:last-child {
            flex: none !important;
            min-width: unset !important;
            width: auto !important;
          }
        }
      `;
