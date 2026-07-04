import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import HallsTabs, { HallsTabKey } from '../../components/tabs/HallsTabs';
import FloorsManagement from '../../components/floors/FloorsManagement';
import HallsManagement from '../../components/halls/HallsManagement';
import TablesManagement from '../../components/tables/TablesManagement';
import KitchensManagement from '../../components/kitchens/KitchensManagement';
import TabTransition from '../../components/ui/TabTransition';
import { useFloors } from '../../hooks/useFloors';
import { useHalls } from '../../hooks/useHalls';
import { useTables } from '../../hooks/useTables';
import { useKitchens } from '../../hooks/useKitchens';
import { Hall } from '../../utils';

export default function HallsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<HallsTabKey>('floors');

  const floorsHook = useFloors();
  const hallsHook = useHalls();
  const tablesHook = useTables({
    onTablesMutated: () => void hallsHook.loadHalls(),
  });
  const kitchensHook = useKitchens();

  const handleViewTables = (hall: Hall) => {
    tablesHook.setSelectedHall(hall); // This updates global store, which triggers useEffect to load tables
    tablesHook.setTableFormState({ id: undefined, number: 1, name: '' });
    setActiveTab('tables');
    // loadTablesForHall will be called automatically by useEffect when activeHallId changes
  };

  const handleTabChange = (tab: HallsTabKey) => {
    setActiveTab(tab);
    if (tab === 'tables') {
      // Auto-select first hall if none is selected
      if (!tablesHook.selectedHall && hallsHook.halls.length > 0) {
        const firstHall = hallsHook.halls[0];
        tablesHook.setSelectedHall(firstHall); // This updates global store, which triggers useEffect to load tables
      }
      // If selectedHall exists, tables will be loaded automatically by useEffect
    }
  };

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title={t('nav.restaurantStructure')} />

        <main className="flex-1 p-6">
          <section className="mx-auto max-w-7xl rounded-soft-xl border border-black/5 bg-cloud-soft-white p-6 shadow-soft">
            <HallsTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />

            <TabTransition activeTab={activeTab}>
              {activeTab === 'floors' && (
                <FloorsManagement
                  floors={floorsHook.floors}
                  loading={floorsHook.loading}
                  error={floorsHook.error}
                  formState={floorsHook.formState}
                  setFormState={floorsHook.setFormState}
                  isFormOpen={floorsHook.isFormOpen}
                  setIsFormOpen={floorsHook.setIsFormOpen}
                  resetForm={floorsHook.resetForm}
                  handleSubmit={floorsHook.handleSubmit}
                  handleEdit={floorsHook.handleEdit}
                  handleDelete={floorsHook.handleDelete}
                />
              )}

              {activeTab === 'halls' && (
                <HallsManagement
                halls={hallsHook.halls}
                floors={hallsHook.floors}
                loading={hallsHook.loading}
                error={hallsHook.error}
                formState={hallsHook.formState}
                setFormState={hallsHook.setFormState}
                isFormOpen={hallsHook.isFormOpen}
                setIsFormOpen={hallsHook.setIsFormOpen}
                resetForm={hallsHook.resetForm}
                handleSubmit={hallsHook.handleSubmit}
                handleEdit={hallsHook.handleEdit}
                handleDelete={hallsHook.handleDelete}
                onViewTables={handleViewTables}
                />
              )}

              {activeTab === 'tables' && (
                <TablesManagement
                halls={tablesHook.halls}
                selectedHall={tablesHook.selectedHall}
                setSelectedHall={tablesHook.setSelectedHall}
                tables={tablesHook.tables}
                loading={tablesHook.loading}
                error={tablesHook.error}
                tableFormState={tablesHook.tableFormState}
                setTableFormState={tablesHook.setTableFormState}
                handleSubmitTable={tablesHook.handleSubmitTable}
                handleEditTable={tablesHook.handleEditTable}
                handleDeleteTable={tablesHook.handleDeleteTable}
                />
              )}

              {activeTab === 'kitchens' && (
                <KitchensManagement
                kitchens={kitchensHook.kitchens}
                floors={kitchensHook.floors}
                loading={kitchensHook.loading}
                error={kitchensHook.error}
                formState={kitchensHook.formState}
                setFormState={kitchensHook.setFormState}
                isFormOpen={kitchensHook.isFormOpen}
                setIsFormOpen={kitchensHook.setIsFormOpen}
                resetForm={kitchensHook.resetForm}
                handleSubmit={kitchensHook.handleSubmit}
                handleEdit={kitchensHook.handleEdit}
                handleDelete={kitchensHook.handleDelete}
                toggleActive={kitchensHook.toggleActive}
                />
              )}
            </TabTransition>
          </section>
      </main>

      <Footer />
    </div>
  );
}
