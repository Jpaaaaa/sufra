import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import ItemsTabs, { ItemsTabKey } from '../../components/tabs/ItemsTabs';
import CategoriesManagement from '../../components/categories/CategoriesManagement';
import ItemsManagement from '../../components/items/ItemsManagement';
import FastPricingTable from '../../components/items/FastPricingTable';
import TabTransition from '../../components/ui/TabTransition';
import { useCategories } from '../../hooks/useCategories';
import { useItems } from '../../hooks/useItems';

export default function ItemsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ItemsTabKey>('categories');

  const categoriesHook = useCategories();
  const itemsHook = useItems();

  return (
    <div className="flex flex-1 flex-col bg-cloud-soft-white">
      <Header title={t('nav.items')} />

        <main className="flex-1 p-6">
          <section className="mx-auto max-w-7xl rounded-soft-xl border border-black/5 bg-cloud-soft-white p-6 shadow-soft">
            <ItemsTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />

            <TabTransition activeTab={activeTab}>
              {activeTab === 'categories' && (
                <CategoriesManagement
                  categories={categoriesHook.categories}
                  loading={categoriesHook.loading}
                  error={categoriesHook.error}
                  formState={categoriesHook.formState}
                  setFormState={categoriesHook.setFormState}
                  isFormOpen={categoriesHook.isFormOpen}
                  setIsFormOpen={categoriesHook.setIsFormOpen}
                  resetForm={categoriesHook.resetForm}
                  handleSubmit={categoriesHook.handleSubmit}
                  handleEdit={categoriesHook.handleEdit}
                  handleDelete={categoriesHook.handleDelete}
                  reorderCategories={categoriesHook.reorderCategories}
                  onCategoriesOrderSaved={() => void itemsHook.loadCategories()}
                  toggleCategoryMenuActive={categoriesHook.toggleCategoryMenuActive}
                />
              )}

              {activeTab === 'items' && (
                <ItemsManagement
                  items={itemsHook.items}
                  categories={itemsHook.categories}
                  kitchens={itemsHook.kitchens}
                  loading={itemsHook.loading}
                  error={itemsHook.error}
                  formState={itemsHook.formState}
                  setFormState={itemsHook.setFormState}
                  isFormOpen={itemsHook.isFormOpen}
                  setIsFormOpen={itemsHook.setIsFormOpen}
                  resetForm={itemsHook.resetForm}
                  handleSubmit={itemsHook.handleSubmit}
                  handleEdit={itemsHook.handleEdit}
                  handleDelete={itemsHook.handleDelete}
                  toggleItemHiddenFromMenu={itemsHook.toggleItemHiddenFromMenu}
                />
              )}

              {activeTab === 'fast-pricing' && (
                <FastPricingTable
                  items={itemsHook.items}
                  categories={itemsHook.categories}
                  loading={itemsHook.loading}
                  error={itemsHook.error}
                  updateItemPrice={itemsHook.updateItemPrice}
                />
              )}
            </TabTransition>
          </section>
      </main>

      <Footer />
    </div>
  );
}
