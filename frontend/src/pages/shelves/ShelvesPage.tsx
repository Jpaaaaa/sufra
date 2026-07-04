import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import ShelvesTabs, { ShelvesTabKey } from '../../components/tabs/ShelvesTabs';
import ShelvesManagement from '../../components/shelves/ShelvesManagement';
import ShelfSellView from '../../components/shelves/ShelfSellView';
import TabTransition from '../../components/ui/TabTransition';
import { useShelves } from '../../hooks/useShelves';
import { useShelvesRefresh } from '../../contexts/ShelvesRefreshContext';

export default function ShelvesPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ShelvesTabKey>('inventory');
  const shelvesHook = useShelves();
  const { subscribe } = useShelvesRefresh();

  // Listen for global sale events to refresh shelves inventory
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      void shelvesHook.loadShelves();
    });
    return unsubscribe;
  }, [subscribe, shelvesHook]);

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title={t('nav.shelves')} />

      <main className="flex-1 p-6">
        <section className="mx-auto max-w-7xl rounded-soft-xl border border-black/5 bg-cloud-soft-white p-6 shadow-soft">
          <ShelvesTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />

          <TabTransition activeTab={activeTab}>
            {activeTab === 'inventory' && (
              <ShelvesManagement
                shelves={shelvesHook.shelves}
                loading={shelvesHook.isLoading}
                error={shelvesHook.error}
                formState={shelvesHook.formState}
                setFormState={shelvesHook.setFormState}
                isFormOpen={shelvesHook.isFormOpen}
                setIsFormOpen={shelvesHook.setIsFormOpen}
                resetForm={shelvesHook.resetForm}
                handleSubmit={shelvesHook.handleSubmit}
                handleEdit={shelvesHook.handleEdit}
                handleDelete={shelvesHook.handleDelete}
              />
            )}

            {activeTab === 'sell' && (
              <ShelfSellView
                onSaleComplete={async () => {
                  // Reload shelves list after sale to update stock
                  await shelvesHook.loadShelves();
                }}
              />
            )}
          </TabTransition>
        </section>
      </main>

      <Footer />
    </div>
  );
}
