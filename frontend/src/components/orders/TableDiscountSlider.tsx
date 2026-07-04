import { memo, useState } from 'react';
import { useGlobalNumericField } from '../../contexts/GlobalNumericKeypadContext';

interface TableDiscountSliderProps {
  tableSubtotal: number;
  tableTotal: number;
  tableDiscount: number;
  onDiscountChange: (discount: number) => void;
}

export const TableDiscountSlider = memo(function TableDiscountSlider({
  tableSubtotal,
  tableDiscount,
  onDiscountChange,
}: TableDiscountSliderProps) {
  const [isPercentage, setIsPercentage] = useState(false);
  
  // Calculate discount value and percentage
  const discountPercentage = tableSubtotal > 0 ? (tableDiscount / tableSubtotal) * 100 : 0;
  // discountAmount calculated from tableDiscount
  
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
    <div className="rounded-lg border border-cyber-aqua/20 bg-white/90 backdrop-blur-sm p-2.5 shadow-sm space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[13px] leading-normal font-semibold text-obsidian">خصم على جميع الطلبات:</span>
        <button
          type="button"
          onClick={handleToggle}
          className="group relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyber-aqua/20 to-olive-gold/20 hover:shadow-soft focus:outline-none focus:ring-2 focus:ring-cyber-aqua/30"
          title={isPercentage ? 'تبديل إلى المبلغ' : 'تبديل إلى النسبة'}
        >
          {/* Background circle with gradient */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white to-cloud-soft-white shadow-inner" />
          
          {/* Active indicator ring */}
          <div className={`absolute inset-0 rounded-full border-2 ${
            isPercentage 
              ? 'border-cyber-aqua shadow-[0_0_8px_rgba(0,200,255,0.4)]' 
              : 'border-olive-gold shadow-[0_0_8px_rgba(139,140,94,0.4)]'
          }`} />
          
          {/* Icon/Indicator */}
          <div className="relative z-10 flex items-center justify-center">
            {isPercentage ? (
              <svg className="h-5 w-5 text-cyber-aqua" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-olive-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          
          {/* Tooltip text */}
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-obsidian/90 px-2 py-1 text-[11px] leading-tight text-white opacity-0 group-hover:opacity-100 pointer-events-none">
            {isPercentage ? 'نسبة' : 'مبلغ'}
          </div>
        </button>
      </div>
      
          {isPercentage ? (
            <div className="space-y-2">
              {/* Enhanced Discount Slider with Tick Marks and Quick Buttons */}
              <div className="space-y-2">
            {/* Slider Container with Tick Marks */}
            <div className="relative flex items-center gap-3">
              <div className="flex-1 relative py-2">
                {/* Tick Marks */}
                <div className="absolute inset-x-0 top-0 flex justify-between pointer-events-none" style={{ paddingLeft: '0px', paddingRight: '0px' }}>
                  {[0, 10, 25, 50, 75, 100].map((tick) => (
                    <div
                      key={tick}
                      className="flex flex-col items-center"
                      style={{ 
                        transform: tick === 0 ? 'translateX(0)' : tick === 100 ? 'translateX(0)' : 'translateX(50%)',
                        marginLeft: tick === 0 ? '0' : '0',
                        marginRight: tick === 100 ? '0' : '0'
                      }}
                    >
                      <div className="h-1.5 w-0.5 bg-slate-300/60 rounded-full" />
                      <div className="mt-0.5 text-[10px] leading-tight text-slate-400 font-medium whitespace-nowrap">
                        {tick}%
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Slider Track */}
                <div className="relative mt-6 py-2 -my-2">
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
                      // Snap to nearest multiple of 5 or tick point
                      const value = Number((e.target as HTMLInputElement).value);
                      const snapPoints = [0, 10, 25, 50, 75, 100];
                      const threshold = 3; // ±3%
                      
                      // First check for major tick points
                      for (const point of snapPoints) {
                        if (Math.abs(value - point) <= threshold) {
                          handleDiscountValueChange(point);
                          return;
                        }
                      }
                      
                      // Otherwise snap to nearest multiple of 5
                      const nearest5 = Math.round(value / 5) * 5;
                      handleDiscountValueChange(nearest5);
                    }}
                    onTouchEnd={(e) => {
                      // Snap to nearest multiple of 5 or tick point on touch
                      const value = Number((e.target as HTMLInputElement).value);
                      const snapPoints = [0, 10, 25, 50, 75, 100];
                      const threshold = 3; // ±3%
                      
                      // First check for major tick points
                      for (const point of snapPoints) {
                        if (Math.abs(value - point) <= threshold) {
                          handleDiscountValueChange(point);
                          return;
                        }
                      }
                      
                      // Otherwise snap to nearest multiple of 5
                      const nearest5 = Math.round(value / 5) * 5;
                      handleDiscountValueChange(nearest5);
                    }}
                    className="table-discount-slider w-full h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, rgb(0, 200, 255) 0%, rgb(0, 200, 255) ${discountPercentage}%, rgba(226, 232, 240, 0.4) ${discountPercentage}%, rgba(226, 232, 240, 0.4) 100%)`
                    }}
                  />
                </div>
              </div>
              
              {/* Value Display */}
              <div className="flex items-center gap-2 min-w-[80px]">
                <input
                  type="text"
                  inputMode="numeric"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.round(discountPercentage)}
                  onChange={(e) => {
                    const value = Number(e.target.value) || 0;
                    // Round to nearest multiple of 5
                    const roundedValue = Math.round(value / 5) * 5;
                    handleDiscountValueChange(roundedValue);
                  }}
                  onFocus={discountValueField.onFocus}
                  className="w-16 rounded-lg border border-cyber-aqua/30 bg-white px-2 py-1.5 text-[14px] leading-normal text-obsidian text-right focus:outline-none focus:border-cyber-aqua focus:ring-2 focus:ring-cyber-aqua/20 shadow-sm"
                />
                <span className="text-[15px] leading-normal font-semibold text-cyber-aqua min-w-[1.5rem]">%</span>
              </div>
            </div>
            
            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleDiscountValueChange(10)}
                className={`px-3 py-1.5 rounded-lg text-[13px] leading-normal font-medium ${
                  Math.abs(discountPercentage - 10) < 1
                    ? 'bg-cyber-aqua text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                10%
              </button>
              <button
                type="button"
                onClick={() => handleDiscountValueChange(25)}
                className={`px-3 py-1.5 rounded-lg text-[13px] leading-normal font-medium ${
                  Math.abs(discountPercentage - 25) < 1
                    ? 'bg-cyber-aqua text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                25%
              </button>
              <button
                type="button"
                onClick={() => handleDiscountValueChange(0)}
                className={`px-3 py-1.5 rounded-lg text-[13px] leading-normal font-medium ${
                  discountPercentage === 0
                    ? 'bg-slate-300 text-slate-700 shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title="إلغاء الخصم"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleDiscountValueChange(100)}
                className={`px-3 py-1.5 rounded-lg text-[13px] leading-normal font-medium ${
                  Math.abs(discountPercentage - 100) < 1
                    ? 'bg-cyber-aqua text-white shadow-md'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                100%
              </button>
            </div>
          </div>
          
        </div>
      ) : (
        <div className="flex items-center gap-2">
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
            className="flex-1 rounded-soft border border-black/5 bg-white px-3 py-2 text-[15px] leading-normal text-obsidian text-right focus:outline-none focus:border-olive-gold focus:ring-2 focus:ring-olive-gold/10"
            placeholder="0"
          />
          <span className="text-[15px] leading-normal font-medium text-obsidian min-w-[3rem]">د.ع</span>
        </div>
      )}
      
      {/* Compact discount display - total shown at top */}
      {tableDiscount > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-black/5">
          <span className="text-[13px] leading-normal font-medium text-red-600">الخصم المطبق:</span>
          <span className="text-[15px] leading-normal font-semibold text-red-600">
            -{Math.round(tableDiscount).toLocaleString('ar-IQ')} د.ع
            {isPercentage && ` (${Math.round(discountPercentage)}%)`}
          </span>
        </div>
      )}
      
      <style>{`
        .table-discount-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          padding: 8px 0;
          margin: -8px 0;
        }
        
        .table-discount-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgb(0, 200, 255), rgb(0, 180, 235));
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0, 200, 255, 0.3), 
                      0 4px 12px rgba(0, 200, 255, 0.2),
                      0 0 0 0 rgba(0, 200, 255, 0.4);
          position: relative;
          z-index: 2;
          margin-top: -8px;
        }
        
        .table-discount-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 3px 10px rgba(0, 200, 255, 0.4), 
                      0 6px 16px rgba(0, 200, 255, 0.3),
                      0 0 0 4px rgba(0, 200, 255, 0.2);
        }
        
        .table-discount-slider::-webkit-slider-thumb:active {
          transform: scale(1.1);
          box-shadow: 0 2px 6px rgba(0, 200, 255, 0.5), 
                      0 4px 10px rgba(0, 200, 255, 0.4),
                      0 0 0 3px rgba(0, 200, 255, 0.3);
        }
        
        .table-discount-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: linear-gradient(135deg, rgb(0, 200, 255), rgb(0, 180, 235));
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0, 200, 255, 0.3), 
                      0 4px 12px rgba(0, 200, 255, 0.2);
          position: relative;
          z-index: 2;
        }
        
        .table-discount-slider::-moz-range-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 3px 10px rgba(0, 200, 255, 0.4), 
                      0 6px 16px rgba(0, 200, 255, 0.3);
        }
        
        .table-discount-slider::-moz-range-thumb:active {
          transform: scale(1.1);
          box-shadow: 0 2px 6px rgba(0, 200, 255, 0.5), 
                      0 4px 10px rgba(0, 200, 255, 0.4);
        }
        
        .table-discount-slider::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 9999px;
          background: transparent;
        }
        
        .table-discount-slider::-moz-range-track {
          height: 6px;
          border-radius: 9999px;
          background: transparent;
          border: none;
        }
      `}</style>
    </div>
  );
});

