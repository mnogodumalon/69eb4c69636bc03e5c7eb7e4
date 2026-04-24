import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import LieferantenPage from '@/pages/LieferantenPage';
import SteuerperiodenPage from '@/pages/SteuerperiodenPage';
import BelegpositionenPage from '@/pages/BelegpositionenPage';
import Skr03KontenplanPage from '@/pages/Skr03KontenplanPage';
import BelegePage from '@/pages/BelegePage';
import LeasingvertraegePage from '@/pages/LeasingvertraegePage';
import PublicFormLieferanten from '@/pages/public/PublicForm_Lieferanten';
import PublicFormSteuerperioden from '@/pages/public/PublicForm_Steuerperioden';
import PublicFormBelegpositionen from '@/pages/public/PublicForm_Belegpositionen';
import PublicFormSkr03Kontenplan from '@/pages/public/PublicForm_Skr03Kontenplan';
import PublicFormBelege from '@/pages/public/PublicForm_Belege';
import PublicFormLeasingvertraege from '@/pages/public/PublicForm_Leasingvertraege';
// <public:imports>
// </public:imports>
// <custom:imports>
const BelegErfassenPage = lazy(() => import('@/pages/intents/BelegErfassenPage'));
const SteuerperiodeAbschliessenPage = lazy(() => import('@/pages/intents/SteuerperiodeAbschliessenPage'));
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/69eb4c3e268be590a3c278b2" element={<PublicFormLieferanten />} />
              <Route path="public/69eb4c3d238c00be8a7ea876" element={<PublicFormSteuerperioden />} />
              <Route path="public/69eb4c41284fb47dd4dddbcf" element={<PublicFormBelegpositionen />} />
              <Route path="public/69eb4c352d3b185b8f5fd7fa" element={<PublicFormSkr03Kontenplan />} />
              <Route path="public/69eb4c3ff1779a5204114e53" element={<PublicFormBelege />} />
              <Route path="public/69eb4c42bac37ace4aba4d62" element={<PublicFormLeasingvertraege />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<DashboardOverview />} />
                <Route path="lieferanten" element={<LieferantenPage />} />
                <Route path="steuerperioden" element={<SteuerperiodenPage />} />
                <Route path="belegpositionen" element={<BelegpositionenPage />} />
                <Route path="skr03-kontenplan" element={<Skr03KontenplanPage />} />
                <Route path="belege" element={<BelegePage />} />
                <Route path="leasingvertraege" element={<LeasingvertraegePage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                <Route path="intents/beleg-erfassen" element={<Suspense fallback={null}><BelegErfassenPage /></Suspense>} />
                <Route path="intents/steuerperiode-abschliessen" element={<Suspense fallback={null}><SteuerperiodeAbschliessenPage /></Suspense>} />
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
