import { useState, useEffect, useMemo } from 'react';
import { TableEntity } from '../../utils';
import { FLOOR_COLORS } from '../../pages/orders/constants';
import { ConfirmMoveDialog } from './ConfirmMoveDialog';
import { useFloorsStore } from '../../../stores/floorsStore';
import { useHallsStore } from '../../../stores/hallsStore';
import { useTablesStore } from '../../../stores/tablesStore';
import type { Hall } from '../../utils';

interface HallWithTables extends Hall {
  tables: TableEntity[];
}

interface MoveToTableModalProps {
  currentTableId: number;
  selectedCount: number;
  onSelectTable: (tableId: number) => void;
  onClose: () => void;
}

export function MoveToTableModal({
  currentTableId,
  selectedCount,
  onSelectTable,
  onClose,
}: MoveToTableModalProps) {
  const floors = useFloorsStore((state) => state.floors);
  const halls = useHallsStore((state) => state.halls);
  const tablesByHallId = useTablesStore((state) => state.tablesByHallId);
  const [loading, setLoading] = useState(true);
  const [selectedFloorId, setSelectedFloorId] = useState<number | 'no-floor' | null>(null);
  const [selectedHallId, setSelectedHallId] = useState<number | null>(null);
  const [pendingTarget, setPendingTarget] = useState<{ tableId: number; tableName: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [loadedHalls] = await Promise.all([
          useHallsStore.getState().loadHalls(),
          useFloorsStore.getState().loadFloors(),
        ]);

        await Promise.all(
          loadedHalls.map((hall) =>
            useTablesStore.getState().loadTablesForHall(hall.id, true),
          ),
        );

        const withTables = loadedHalls.map((hall) => ({
          ...hall,
          tables: useTablesStore.getState().getTablesForHall(hall.id),
        }));

        const firstHallWithTables = withTables.find((h) =>
          h.tables.some((t) => t.id !== currentTableId),
        );
        if (firstHallWithTables) {
          setSelectedHallId(firstHallWithTables.id);
        }
      } catch {
        /* store handles empty state */
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [currentTableId]);

  const hallsWithTables: HallWithTables[] = useMemo(
    () =>
      halls.map((hall) => ({
        ...hall,
        tables: tablesByHallId[hall.id] ?? [],
      })),
    [halls, tablesByHallId],
  );

  const { byFloor, noFloor } = useMemo(() => {
    const byFloor: { floor: { id: number; name: string; number: number }; halls: HallWithTables[] }[] = [];
    const noFloor: HallWithTables[] = [];

    const sortedFloors = [...floors].sort((a, b) => a.number - b.number);
    for (const floor of sortedFloors) {
      const hallsOnFloor = hallsWithTables
        .filter((h) => h.floor_id === floor.id)
        .sort((a, b) => a.number - b.number);
      if (hallsOnFloor.length > 0) {
        byFloor.push({ floor, halls: hallsOnFloor });
      }
    }
    const withoutFloor = hallsWithTables
      .filter((h) => h.floor_id == null)
      .sort((a, b) => a.number - b.number);
    if (withoutFloor.length > 0) noFloor.push(...withoutFloor);

    return { byFloor, noFloor };
  }, [floors, hallsWithTables]);

  const filteredContent = useMemo(() => {
    if (selectedFloorId === null) {
      return { byFloor, noFloor };
    }
    if (selectedFloorId === 'no-floor') {
      return { byFloor: [] as { floor: { id: number; name: string; number: number }; halls: HallWithTables[] }[], noFloor };
    }
    const floor = floors.find((f) => f.id === selectedFloorId);
    const hallsOnFloor = hallsWithTables
      .filter((h) => h.floor_id === selectedFloorId)
      .sort((a, b) => a.number - b.number);
    return {
      byFloor: floor && hallsOnFloor.length > 0 ? [{ floor, halls: hallsOnFloor }] : [],
      noFloor: [] as HallWithTables[],
    };
  }, [selectedFloorId, byFloor, noFloor, floors, hallsWithTables]);

  const hallsToShow = useMemo(() => {
    const fromFloors = filteredContent.byFloor.flatMap(({ halls }) => halls);
    const fromNoFloor = filteredContent.noFloor;
    return [...fromFloors, ...fromNoFloor].filter((h) =>
      h.tables.some((t) => t.id !== currentTableId)
    );
  }, [filteredContent, currentTableId]);

  const selectedHall = useMemo(
    () => hallsToShow.find((h) => h.id === selectedHallId) ?? null,
    [hallsToShow, selectedHallId]
  );

  const totalOtherTables = useMemo(() => {
    return hallsWithTables.reduce(
      (sum, h) => sum + h.tables.filter((t) => t.id !== currentTableId).length,
      0
    );
  }, [hallsWithTables, currentTableId]);

  const handleFloorChange = (floorId: number | 'no-floor' | null) => {
    setSelectedFloorId(floorId);
    setSelectedHallId(null);
  };

  useEffect(() => {
    if (hallsToShow.length > 0 && (selectedHallId === null || !hallsToShow.some((h) => h.id === selectedHallId))) {
      setSelectedHallId(hallsToShow[0].id);
    }
  }, [hallsToShow, selectedHallId]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-obsidian/70 p-4"
      onClick={onClose}
    >
      <div
        className="rounded-xl border border-black/10 bg-white shadow-lg max-w-2xl w-full max-h-[85vh] flex flex-col p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-[18px] font-bold text-obsidian mb-1">
          نقل {selectedCount} طلب إلى طاولة
        </h3>
        <p className="text-[14px] text-obsidian/70 mb-3">
          اختر الطابق ثم الصالة ثم الطاولة المستهدفة
        </p>
        {!loading && totalOtherTables > 0 && (
          <div className="mb-4 flex flex-col gap-3">
            <div className="inline-flex flex-wrap gap-2 rounded-lg border border-stone-200 bg-stone-50/50 p-1.5">
              <button
                type="button"
                onClick={() => handleFloorChange(null)}
                className={`rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${
                  selectedFloorId === null
                    ? 'bg-cyber-aqua text-white shadow-sm'
                    : 'text-obsidian/70 hover:bg-white hover:text-obsidian'
                }`}
              >
                الكل
              </button>
              {byFloor.map(({ floor }, idx) => (
                <button
                  key={floor.id}
                  type="button"
                  onClick={() => handleFloorChange(floor.id)}
                  className={`rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${
                    selectedFloorId === floor.id
                      ? 'text-white shadow-sm'
                      : 'text-obsidian/70 hover:bg-white hover:text-obsidian'
                  }`}
                  style={
                    selectedFloorId === floor.id
                      ? { backgroundColor: FLOOR_COLORS[idx % FLOOR_COLORS.length] }
                      : undefined
                  }
                >
                  {floor.number} · {floor.name}
                </button>
              ))}
              {noFloor.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleFloorChange('no-floor')}
                  className={`rounded-md px-3 py-2 text-[13px] font-semibold transition-colors ${
                    selectedFloorId === 'no-floor'
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'text-obsidian/70 hover:bg-white hover:text-obsidian'
                  }`}
                >
                  بدون طابق
                </button>
              )}
            </div>
          </div>
        )}
        {loading ? (
          <div className="py-12 text-center text-obsidian/60">جاري التحميل...</div>
        ) : totalOtherTables === 0 ? (
          <div className="py-12 text-center text-obsidian/60">
            لا توجد طاولات أخرى
          </div>
        ) : hallsToShow.length === 0 ? (
          <div className="py-12 text-center text-obsidian/60">
            {selectedFloorId === 'no-floor'
              ? 'لا توجد صالات بدون طابق'
              : selectedFloorId != null
                ? 'لا توجد صالات في هذا الطابق'
                : 'لا توجد طاولات أخرى'}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
            <div>
              <p className="text-[13px] font-medium text-obsidian/70 mb-2">اختر الصالة</p>
              <div
                className="flex flex-nowrap gap-3 overflow-x-auto pb-2 -mx-1 px-1"
                style={{ scrollbarWidth: 'thin' }}
              >
                {hallsToShow.map((hall) => {
                  const otherCount = hall.tables.filter((t) => t.id !== currentTableId).length;
                  const isSelected = selectedHallId === hall.id;
                  return (
                    <button
                      key={hall.id}
                      type="button"
                      onClick={() => setSelectedHallId(hall.id)}
                      className={`flex-shrink-0 w-[140px] rounded-xl border-2 p-4 text-right transition-all ${
                        isSelected
                          ? 'border-cyber-aqua bg-cyber-aqua/10 shadow-md'
                          : 'border-stone-200 bg-stone-50 hover:border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      <p className="text-[15px] font-bold text-obsidian truncate">{hall.name}</p>
                      <p className="text-[12px] text-obsidian/60 mt-0.5">
                        {otherCount} طاولة
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedHall && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <p className="text-[13px] font-medium text-obsidian/70 mb-2">
                  طاولات {selectedHall.name}
                </p>
                <div
                  className="flex-1 min-h-0 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 content-start pr-1"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {selectedHall.tables
                    .filter((t) => t.id !== currentTableId)
                    .map((t) => {
                      const tableName = t.name || `طاولة ${t.number}`;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setPendingTarget({ tableId: t.id, tableName })}
                          className="rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-[14px] font-semibold text-obsidian hover:border-cyber-aqua hover:bg-cyber-aqua/10 transition-colors"
                        >
                          {tableName}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-stone-200 px-4 py-2 text-[15px] font-medium text-obsidian/70 hover:bg-stone-50 flex-shrink-0"
        >
          إلغاء
        </button>
      </div>
      <ConfirmMoveDialog
        open={!!pendingTarget}
        title={pendingTarget ? `نقل ${selectedCount} طلب إلى ${pendingTarget.tableName}؟` : ''}
        message="سيتم نقل الطلبات المحددة إلى الطاولة المستهدفة."
        onConfirm={() => {
          if (pendingTarget) {
            onSelectTable(pendingTarget.tableId);
            setPendingTarget(null);
          }
        }}
        onCancel={() => setPendingTarget(null)}
      />
    </div>
  );
}
