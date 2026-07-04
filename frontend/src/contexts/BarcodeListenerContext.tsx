'use client';

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';

interface BarcodeListenerContextType {
  isListening: boolean;
  setBarcodeHandler: (handler: ((barcode: string) => void) | null) => void;
  setPriorityHandler: (handler: ((barcode: string) => void) | null) => void;
}

const BarcodeListenerContext = createContext<BarcodeListenerContextType | undefined>(undefined);

export function BarcodeListenerProvider({ children }: { children: ReactNode }) {
  const [isListening] = useState(true);
  const barcodeHandlerRef = useRef<((barcode: string) => void) | null>(null);
  const priorityHandlerRef = useRef<((barcode: string) => void) | null>(null);
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Barcode scanners typically send characters very quickly (< 50ms between keys)
  // and end with Enter. We accumulate characters until Enter is pressed.
  const BARCODE_TIMEOUT = 100; // ms - if no key for 100ms, reset buffer
  const MAX_BARCODE_LENGTH = 100; // reasonable max length

  const setBarcodeHandler = (handler: ((barcode: string) => void) | null) => {
    barcodeHandlerRef.current = handler;
  };

  const setPriorityHandler = (handler: ((barcode: string) => void) | null) => {
    priorityHandlerRef.current = handler;
  };

  useEffect(() => {
    if (!isListening) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.getAttribute('contenteditable') === 'true');

      if (isInputFocused) {
        // Reset buffer if user is typing manually
        barcodeBufferRef.current = '';
        return;
      }

      // Prevent default for Enter key to avoid form submissions
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();

        const barcode = barcodeBufferRef.current.trim();
        if (barcode.length > 0) {
          const handler = priorityHandlerRef.current ?? barcodeHandlerRef.current;
          if (handler) handler(barcode);
        }
        barcodeBufferRef.current = '';
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        return;
      }

      // Ignore modifier keys and special keys
      // Safety check: ensure e.key exists before accessing properties
      if (
        !e.key ||
        e.key.length > 1 ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.key === 'Tab' ||
        e.key === 'Escape'
      ) {
        return;
      }

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTimeRef.current;

      // If too much time passed since last key, reset buffer (user typing manually)
      if (timeSinceLastKey > BARCODE_TIMEOUT && barcodeBufferRef.current.length > 0) {
        barcodeBufferRef.current = '';
      }

      // Add character to buffer
      if (barcodeBufferRef.current.length < MAX_BARCODE_LENGTH) {
        barcodeBufferRef.current += e.key;
      }

      lastKeyTimeRef.current = now;

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set timeout to reset buffer if no more keys come
      timeoutRef.current = setTimeout(() => {
        barcodeBufferRef.current = '';
      }, BARCODE_TIMEOUT);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isListening]);

  return (
    <BarcodeListenerContext.Provider
      value={{
        isListening,
        setBarcodeHandler,
        setPriorityHandler,
      }}
    >
      {children}
    </BarcodeListenerContext.Provider>
  );
}

export function useBarcodeListener() {
  const context = useContext(BarcodeListenerContext);
  if (context === undefined) {
    throw new Error('useBarcodeListener must be used within a BarcodeListenerProvider');
  }
  return context;
}

