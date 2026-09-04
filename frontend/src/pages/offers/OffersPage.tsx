import { useTranslation } from 'react-i18next';
import Header from '../../components/layout/Header';
import Footer from '../../components/layout/Footer';
import OffersCenter from '../../components/offers/OffersCenter';
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
          <OffersCenter offers={offers} items={items.items} isManager={isManager} />
        </section>
      </main>

      <Footer />
    </div>
  );
}
