import { useTranslation } from 'react-i18next';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import OffersTabs from '../../components/tabs/OffersTabs';
import OffersManagement from '../../components/offers/OffersManagement';
import { useOffers } from '../../hooks/useOffers';
import { useItems } from '../../hooks/useItems';
import { useAuth } from '../../contexts/AuthContext';

export default function OffersPage() {
  const { t } = useTranslation();
  const offers = useOffers();
  const items = useItems();
  const { user } = useAuth();
  
  const isManager = user?.role === 'manager' || user?.role === 'admin';

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <Header title={t('nav.offers')} />

      <main className="flex-1 p-6">
        <section className="mx-auto max-w-6xl">
          <OffersTabs />

          {!isManager && (
            <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-6">
              <p className="text-[15px] leading-normal text-orange-800">
                ⚠️ {t('offers.managerOnlyWarning')}
              </p>
            </div>
          )}

          <OffersManagement
            offers={offers}
            items={items.items}
            loadingItems={items.loading}
            isManager={isManager}
          />
        </section>
      </main>

      <Footer />
    </div>
  );
}
