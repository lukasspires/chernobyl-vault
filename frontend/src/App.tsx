import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HistoryPage } from './pages/History';
import { Library } from './pages/Library';
import { Reader } from './pages/Reader';
import { SeriesPage } from './pages/Series';
import { SettingsPage } from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Library />} />
            <Route path="series/:id" element={<SeriesPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="read/:chapterId" element={<Reader />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
