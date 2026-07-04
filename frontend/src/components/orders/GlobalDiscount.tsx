import { memo, useState } from 'react';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';

interface GlobalDiscountProps {
  tableSubtotal: number;
  tableDiscount: number;
  appliedDiscount: { percent: number; amount: number } | null;
  onDiscountChange: (discount: number) => void;
  onApplyDiscount: () => void;
}

export const GlobalDiscount = memo(function GlobalDiscount({
  tableSubtotal,
  tableDiscount,
  appliedDiscount,
  onDiscountChange,
  onApplyDiscount,
}: GlobalDiscountProps) {
  const [isPercentage, setIsPercentage] = useState(false);
  
  // Calculate discount value and percentage
  // For display, show current tableDiscount (user can still adjust)
  // But if appliedDiscount exists, show it as applied
  const discountPercentage = tableSubtotal > 0 ? (tableDiscount / tableSubtotal) * 100 : 0;
  
  const handleDiscountValueChange = (value: number) => {
    if (isPercentage) {
      // Convert percentage to amount
      const percentageValue = Math.max(0, Math.min(100, value));
      const calculatedDiscount = (tableSubtotal * percentageValue) / 100;
      onDiscountChange(Math.round(calculatedDiscount));
    } else {
      // Use fixed amount
      const amountValue = Math.max(0, Math.min(tableSubtotal, value));
      onDiscountChange(Math.round(amountValue));
    }
  };
  
  const handleToggle = () => {
    setIsPercentage(!isPercentage);
  };

  const discountValueField = useGlobalNumericField(
    isPercentage ? String(Math.round(discountPercentage)) : String(tableDiscount || ''),
    (s) => handleDiscountValueChange(Number(s) || 0),
  );

  if (tableSubtotal === 0) return null;

  return (
    <div 
      className="border-b border-black/5 bg-gradient-to-r from-cyber-aqua/8 via-cyber-aqua/12 to-cyber-aqua/8 flex-shrink-0 rounded-lg shadow-sm"
      style={{
        minHeight: '80px',
        padding: '12px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        direction: 'rtl',
      }}
    >
      {/* Row 1: Icon + Label + Input + Slider */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          whiteSpace: 'nowrap',
        }}
      >
        {/* Toggle Icon */}
        <button
          type="button"
          onClick={handleToggle}
          className="group relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyber-aqua/20 to-olive-gold/20 hover:shadow-soft focus:outline-none focus:ring-2 focus:ring-cyber-aqua/30"
          title={isPercentage ? 'تبديل إلى المبلغ' : 'تبديل إلى النسبة'}
          style={{ flexShrink: 0 }}
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white to-cloud-soft-white shadow-inner" />
          <div className={`absolute inset-0 rounded-full border-2 ${
            isPercentage 
              ? 'border-cyber-aqua shadow-[0_0_8px_rgba(0,200,255,0.4)]' 
              : 'border-olive-gold shadow-[0_0_8px_rgba(139,140,94,0.4)]'
          }`} />
          <div className="relative z-10 flex items-center justify-center">
            {isPercentage ? (
              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-cyber-aqua" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ) : (
              <svg className="h-4 w-4 sm:h-5 sm:w-5 text-olive-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
        </button>

        {/* Label */}
        <span 
          className="text-[13px] sm:text-[14px] md:text-[15px] leading-normal font-bold text-obsidian"
          style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          الخصم العام:
        </span>

        {/* Input/Controls */}
        {isPercentage ? (
          <>
            {/* Percentage Input */}
            <input
              type="text"
              inputMode="numeric"
              min="0"
              max="100"
              step="5"
              value={Math.round(discountPercentage)}
              onChange={(e) => {
                const value = Number(e.target.value) || 0;
                const roundedValue = Math.round(value / 5) * 5;
                handleDiscountValueChange(roundedValue);
              }}
              onFocus={discountValueField.onFocus}
              className="w-16 sm:w-18 rounded-lg border-2 border-cyber-aqua/40 bg-white px-2 py-1.5 text-[13px] sm:text-[14px] leading-normal text-obsidian text-right font-semibold focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-cyber-aqua/20 shadow-sm"
              style={{ whiteSpace: 'nowrap', flexShrink: 0, direction: 'ltr' }}
            />
            <span 
              className="text-[13px] sm:text-[14px] leading-normal font-bold text-cyber-aqua"
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              %
            </span>
            
            {/* Slider - flex:1 to fill remaining space */}
            <div 
              className="relative px-2 sm:px-3"
              style={{ 
                flex: 1,
                minWidth: '120px',
                flexShrink: 0,
              }}
            >
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={discountPercentage}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  handleDiscountValueChange(value);
                }}
                onMouseUp={(e) => {
                  const value = Number((e.target as HTMLInputElement).value);
                  const snapPoints = [0, 10, 25, 50, 75, 100];
                  const threshold = 3;
                  for (const point of snapPoints) {
                    if (Math.abs(value - point) <= threshold) {
                      handleDiscountValueChange(point);
                      return;
                    }
                  }
                  const nearest5 = Math.round(value / 5) * 5;
                  handleDiscountValueChange(nearest5);
                }}
                onTouchEnd={(e) => {
                  const value = Number((e.target as HTMLInputElement).value);
                  const snapPoints = [0, 10, 25, 50, 75, 100];
                  const threshold = 3;
                  for (const point of snapPoints) {
                    if (Math.abs(value - point) <= threshold) {
                      handleDiscountValueChange(point);
                      return;
                    }
                  }
                  const nearest5 = Math.round(value / 5) * 5;
                  handleDiscountValueChange(nearest5);
                }}
                className="global-discount-slider w-full h-3 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgb(0, 200, 255) 0%, rgb(0, 200, 255) ${discountPercentage}%, rgba(226, 232, 240, 0.4) ${discountPercentage}%, rgba(226, 232, 240, 0.4) 100%)`,
                  direction: 'ltr',
                }}
              />
            </div>
            
            {/* Apply Discount Button */}
            <button
              type="button"
              onClick={onApplyDiscount}
              disabled={discountPercentage === 0 && !appliedDiscount}
              className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-3 sm:px-4 py-1.5 sm:py-2 text-[12px] sm:text-[13px] leading-normal font-bold text-white shadow-md hover:shadow-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md transform active:translate-y-0 whitespace-nowrap flex-shrink-0"
            >
              {appliedDiscount ? (discountPercentage === 0 ? 'إلغاء الخصم' : 'تحديث الخصم') : 'تطبيق الخصم'}
            </button>
          </>
        ) : (
          <>
            {/* Amount Input */}
            <input
              type="text"
              inputMode="decimal"
              min="0"
              max={tableSubtotal}
              step="1"
              value={tableDiscount || ''}
              onChange={(e) => {
                const value = Number(e.target.value) || 0;
                handleDiscountValueChange(value);
              }}
              onFocus={discountValueField.onFocus}
              className="w-24 sm:w-28 rounded-lg border-2 border-black/10 bg-white px-2 py-1.5 text-[13px] sm:text-[14px] leading-normal text-obsidian text-right font-semibold focus:outline-none focus:border-olive-gold focus:ring-2 focus:ring-olive-gold/20 shadow-sm"
              placeholder="0"
              style={{ whiteSpace: 'nowrap', flexShrink: 0, direction: 'ltr' }}
            />
            <span 
              className="text-[13px] sm:text-[14px] leading-normal font-semibold text-obsidian"
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              د.ع
            </span>
            
            {/* Apply Discount Button */}
            <button
              type="button"
              onClick={onApplyDiscount}
              disabled={tableDiscount === 0 && !appliedDiscount}
              className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-3 sm:px-4 py-1.5 sm:py-2 text-[12px] sm:text-[13px] leading-normal font-bold text-white shadow-md hover:shadow-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md transform active:translate-y-0 whitespace-nowrap flex-shrink-0"
            >
              {appliedDiscount ? (tableDiscount === 0 ? 'إلغاء الخصم' : 'تحديث الخصم') : 'تطبيق الخصم'}
            </button>
          </>
        )}
      </div>

      {/* Row 2: Discount Value Display */}
      {(tableDiscount > 0 || appliedDiscount) && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span 
            className={`text-[13px] sm:text-[14px] md:text-[15px] leading-normal font-bold px-4 py-2 rounded-lg border-2 shadow-sm ${
              appliedDiscount 
                ? 'text-green-700 bg-green-50 border-green-200' 
                : 'text-red-600 bg-red-50 border-red-200'
            }`}
            style={{ whiteSpace: 'nowrap' }}
          >
            -{Math.round(appliedDiscount ? appliedDiscount.amount : tableDiscount).toLocaleString('ar-IQ')} د.ع
            {isPercentage && ` (${Math.round(appliedDiscount ? (appliedDiscount.percent) : discountPercentage)}%)`}
            {appliedDiscount && ' ✓ مطبق'}
          </span>
        </div>
      )}
      
      <style>{`
        .global-discount-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          padding: 8px 0;
          margin: -8px 0;
          width: 100%;
        }
        
        .global-discount-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgb(0, 200, 255), rgb(0, 180, 235));
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0, 200, 255, 0.5), 0 0 0 3px rgba(0, 200, 255, 0.15);
          position: relative;
          z-index: 2;
          margin-top: -8px;
        }
        
        .global-discount-slider::-webkit-slider-thumb:hover {
          transform: scale(1.3);
          box-shadow: 0 4px 10px rgba(0, 200, 255, 0.6), 0 0 0 4px rgba(0, 200, 255, 0.2);
        }
        
        .global-discount-slider::-webkit-slider-thumb:active {
          transform: scale(1.2);
          box-shadow: 0 3px 7px rgba(0, 200, 255, 0.7), 0 0 0 3px rgba(0, 200, 255, 0.25);
        }
        
        .global-discount-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgb(0, 200, 255), rgb(0, 180, 235));
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0, 200, 255, 0.5), 0 0 0 3px rgba(0, 200, 255, 0.15);
          position: relative;
          z-index: 2;
        }
        
        .global-discount-slider::-moz-range-thumb:hover {
          transform: scale(1.3);
          box-shadow: 0 4px 10px rgba(0, 200, 255, 0.6), 0 0 0 4px rgba(0, 200, 255, 0.2);
        }
        
        .global-discount-slider::-moz-range-thumb:active {
          transform: scale(1.2);
          box-shadow: 0 3px 7px rgba(0, 200, 255, 0.7), 0 0 0 3px rgba(0, 200, 255, 0.25);
        }
        
        .global-discount-slider::-webkit-slider-runnable-track {
          height: 10px;
          border-radius: 9999px;
          background: transparent;
          width: 100%;
        }
        
        .global-discount-slider::-moz-range-track {
          height: 10px;
          border-radius: 9999px;
          background: transparent;
          border: none;
          width: 100%;
        }
      `}</style>
    </div>
  );
});
